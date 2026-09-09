import { spawn } from "node:child_process";
import { mkdir, realpath } from "node:fs/promises";
import type { Context } from "@deepseek-ai/cordis";
import AgentLoop from "@deepseek-ai/dsh-agent-loop";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import Schema from "@deepseek-ai/schemastery";
import { AcpConnection } from "./acp.js";
import { contextWithCapturingFactory, makeRouter, RoutingFactory } from "./factory.js";
import { listDirCommand, normalizeHost, parentOf, parseDirListing, sshConfigHosts, sshPlainArgs } from "./hosts.js";
import { DEFAULT_MIRROR_ROOT, fromMirror, pushRecent, toMirror } from "./mirror.js";
import { RemoteDriver } from "./remote.js";
import { DEFAULT_STORE, loadHosts, mergeHosts, saveHosts, validateHost } from "./store.js";
import type { NormalizedHost, SshPluginConfig } from "./types.js";

export * from "./types.js";
export * from "./hosts.js";
export * from "./mirror.js";
export * from "./store.js";
export * from "./acp.js";
export * from "./updates.js";
export * from "./factory.js";
export * from "./remote.js";

export const NAMESPACE = "dshSsh";
export const name = "dsh-ssh";

export const Config: Schema<SshPluginConfig> = Schema.object({
  hosts: Schema.array(Schema.any()).default([]).description("Configured remote SSH hosts"),
  storePath: Schema.string().default(DEFAULT_STORE).description("File path to persist added hosts"),
  mirrorRoot: Schema.string().default(DEFAULT_MIRROR_ROOT).description("Root directory for local shadows"),
  agentLoop: Schema.any().default({}).description("Options passed to AgentLoop"),
});

export default class DshSsh extends TypertRemoteService {
  static inject = [
    "agents",
    "sessions",
    "tools",
    "systemPrompt",
    "sessionProjections",
    "approval",
    "workspaceRegistry",
  ];

  private log = (m: string) => console.warn(`[dsh-ssh] ${m}`);
  private configHosts: NormalizedHost[];
  private storeHosts: NormalizedHost[] = [];
  private storePath: string;
  private mirrorRoot: string;
  private canonicalRoot: string | null = null;
  private targets: { bySession: Map<string, NormalizedHost>; pending: NormalizedHost | null } = {
    bySession: new Map(),
    pending: null,
  };
  private connections = new Map<string, AcpConnection>();
  private localFactory: { factory: any } = { factory: null };
  private driver: RemoteDriver;

  constructor(ctx: Context, config: SshPluginConfig = {}) {
    super(ctx, NAMESPACE);

    this.configHosts = (Array.isArray(config.hosts) ? config.hosts : [])
      .map((h: any) => normalizeHost(typeof h === "string" ? { name: h, source: "config" } : { ...h, source: "config" }))
      .filter((h): h is NormalizedHost => h !== null);

    this.storePath = config.storePath ?? DEFAULT_STORE;
    this.mirrorRoot = config.mirrorRoot ?? DEFAULT_MIRROR_ROOT;

    (ctx as any).effect(() => {
      this.canonicalMirrorRoot().catch((e) => this.log(`mirror root inaccessible: ${e.message}`));
      return () => {};
    }, "dshSsh.mirrorRoot()");

    (ctx as any).effect(() => {
      loadHosts(this.storePath)
        .then((hs) => {
          this.storeHosts = hs;
          if (hs.length) this.log(`loaded persisted hosts: ${hs.length}`);
        })
        .catch(() => {});
      return () => {};
    }, "dshSsh.loadHosts()");

    const loopCtx = contextWithCapturingFactory(ctx, (f) => {
      this.localFactory.factory = f;
      if (f) this.log("standard AgentLoop factory captured");
    });

    (ctx as any).effect(() => {
      const fiber = (loopCtx as any).plugin(AgentLoop, config.agentLoop ?? {});
      return () => {
        try {
          fiber?.dispose?.();
        } catch {
          // ignore
        }
      };
    }, "dshSsh.agentLoop()");

    this.driver = new RemoteDriver({
      ctx,
      connectionFor: (host) => this.connectionFor(host),
      log: this.log,
      remoteCwd: (options, host) => this.remoteCwdFor(options, host),
    });

    const routing = new RoutingFactory(
      this.localFactory,
      this.driver,
      makeRouter(this.targets, (cwd) => this.hostByFolder(cwd)),
      this.log
    );

    (ctx as any).effect(() => (ctx as any).agents.setFactory(routing), "dshSsh.setFactory()");
  }

  get hostList(): NormalizedHost[] {
    return mergeHosts(this.configHosts, this.storeHosts);
  }

  hostByName(n: string): NormalizedHost {
    const h = this.hostList.find((x) => x.name === n);
    if (!h) throw new Error(`dsh-ssh: host "${n}" is not configured`);
    return h;
  }

  async connectionFor(host: NormalizedHost): Promise<AcpConnection> {
    const live = this.connections.get(host.name);
    if (live && !live.closed) return live;
    await AcpConnection.reapStale(host);
    const conn = new AcpConnection(host, {
      onUpdate: (sid, u) => this.driver.onUpdate(sid, u),
      onPermission: (p) => this.driver.onPermission(p),
      onStderr: (l) => l && this.log(`${host.name}: ${l}`),
      onClosed: (why) => {
        this.connections.delete(host.name);
        this.driver.onConnectionLost(host, why);
        this.log(`${host.name}: ${why}`);
      },
    }).start();
    this.connections.set(host.name, conn);
    return conn;
  }

  async canonicalMirrorRoot(): Promise<string> {
    if (this.canonicalRoot) return this.canonicalRoot;
    await mkdir(this.mirrorRoot, { recursive: true });
    this.canonicalRoot = await realpath(this.mirrorRoot);
    if (this.canonicalRoot !== this.mirrorRoot) this.mirrorRoot = this.canonicalRoot;
    return this.canonicalRoot;
  }

  hostByFolder(localPath: string): NormalizedHost | null {
    const m = fromMirror(this.mirrorRoot, localPath);
    if (!m) return null;
    return this.hostList.find((h) => h.name === m.host) ?? null;
  }

  remoteCwdFor(options: any, host: NormalizedHost): string | null {
    const m = fromMirror(this.mirrorRoot, options?.meta?.cwd);
    return (m && m.host === host.name ? m.path : null) ?? host.cwd;
  }

  async rememberInto(host: NormalizedHost, path: string): Promise<string[]> {
    const kept = this.storeHosts.find((h) => h.name === host.name);
    const base = kept ?? { ...host, source: "user" as const };
    const updated = { ...base, recent: pushRecent(base.recent, path) };
    this.storeHosts = [...this.storeHosts.filter((h) => h.name !== host.name), updated];
    await saveHosts(this.storeHosts, this.storePath).catch((e) =>
      this.log(`failed to save folder list: ${e.message}`)
    );
    return updated.recent;
  }

  @Remote("hosts")
  async hosts(): Promise<any> {
    return {
      hosts: this.hostList.map((h) => ({
        name: h.name,
        ssh: h.ssh,
        port: h.port,
        identityFile: h.identityFile,
        cwd: h.cwd,
        recent: h.recent ?? [],
        source: h.source,
        connected: this.connections.get(h.name)?.closed === false,
      })),
      suggestions: await sshConfigHosts(),
      target: this.targets.pending?.name ?? null,
      mirrorRoot: await this.canonicalMirrorRoot().catch((e) => {
        this.log(`mirror root not canonicalized: ${e.message}`);
        return this.mirrorRoot;
      }),
    };
  }

  @Remote("target")
  async target(): Promise<any> {
    return { target: this.targets.pending?.name ?? null };
  }

  @Remote("setTarget")
  async setTarget(name: string | null | undefined): Promise<any> {
    this.targets.pending = name === null || name === undefined ? null : this.hostByName(name);
    this.log(`target for new sessions: ${this.targets.pending?.name ?? "Local"}`);
    return { target: this.targets.pending?.name ?? null };
  }

  @Remote("addHost")
  async addHost(name: string, ssh?: string, port?: number, identityFile?: string, cwd?: string): Promise<any> {
    const entry = { name, ssh, port, identityFile, cwd };
    const bad = validateHost(entry);
    if (bad) return { ok: false, error: bad };
    if (this.configHosts.some((h) => h.name === String(name).trim())) {
      return { ok: false, error: "Host name already defined in config patch" };
    }
    const host = normalizeHost(entry)!;
    this.storeHosts = [...this.storeHosts.filter((h) => h.name !== host.name), host];
    try {
      await saveHosts(this.storeHosts, this.storePath);
    } catch (e: any) {
      return { ok: false, error: `Failed to persist: ${String(e.message ?? e).slice(0, 200)}` };
    }
    this.log(`host saved: ${host.name} -> ${host.ssh}${host.port ? ":" + host.port : ""}`);
    return { ok: true, name: host.name };
  }

  @Remote("removeHost")
  async removeHost(name: string): Promise<any> {
    const n = String(name ?? "").trim();
    if (this.configHosts.some((h) => h.name === n)) {
      return { ok: false, error: "Host is configured in config patch; remove it there" };
    }
    const before = this.storeHosts.length;
    this.storeHosts = this.storeHosts.filter((h) => h.name !== n);
    if (this.storeHosts.length === before) return { ok: false, error: "Host not found" };
    this.connections.get(n)?.dispose();
    this.connections.delete(n);
    if (this.targets.pending?.name === n) this.targets.pending = null;
    await saveHosts(this.storeHosts, this.storePath).catch(() => {});
    return { ok: true };
  }

  @Remote("sessionHost")
  async sessionHost(sessionId?: string): Promise<any> {
    const host = this.driver?.hostOf(sessionId);
    return { name: host?.name ?? null };
  }

  @Remote("listDir")
  async listDir(name?: string, entry?: any, path?: string): Promise<any> {
    const host = name ? this.hostByName(name) : normalizeHost(entry);
    if (!host) return { ok: false, error: "Host not specified" };
    const target = String(path ?? "").trim() || host.cwd || "~";
    return new Promise((resolve) => {
      let out = "";
      let err = "";
      const p = spawn("ssh", sshPlainArgs(host, listDirCommand(target), { connectTimeout: 15 }), {
        stdio: ["ignore", "pipe", "pipe"],
      });
      p.stdout.on("data", (c) => {
        out += c;
      });
      p.stderr.on("data", (c) => {
        err += c;
      });
      p.on("error", (e) => resolve({ ok: false, error: `ssh failed to execute: ${e.message}` }));
      p.on("exit", (code) => {
        if (code === 2) return resolve({ ok: false, error: "Path does not exist" });
        if (code === 4) return resolve({ ok: false, error: "Path is a file, not a directory" });
        if (code === 3) return resolve({ ok: false, error: "Permission denied" });
        if (code !== 0) {
          return resolve({
            ok: false,
            error: err.trim().split("\n").pop()?.slice(0, 200) || `ssh returned exit code ${code}`,
          });
        }
        const { resolved, entries } = parseDirListing(out);
        resolve({ ok: true, path: resolved, parent: parentOf(resolved), entries });
      });
      setTimeout(() => {
        try {
          p.kill();
        } catch {
          // ignore
        }
      }, 30000).unref?.();
    });
  }

  @Remote("probe")
  async probe(name?: string, entry?: any): Promise<any> {
    const host = name ? this.hostByName(name) : normalizeHost(entry);
    if (!host) return { ok: false, error: "Invalid host configuration" };
    const started = Date.now();
    let conn: AcpConnection | null = null;
    try {
      conn = new AcpConnection(host, {
        onUpdate: () => {},
        onPermission: async () => "reject-once",
        onClosed: () => {},
      }).start();
      const init = await conn.initialize();
      return {
        ok: true,
        ms: Date.now() - started,
        agent: `${init?.agentInfo?.name ?? "?"} ${init?.agentInfo?.version ?? ""}`.trim(),
        capabilities: Object.keys(init?.agentCapabilities?.sessionCapabilities ?? {}),
      };
    } catch (e: any) {
      return { ok: false, ms: Date.now() - started, error: String(e?.message ?? e).slice(0, 300) };
    } finally {
      conn?.dispose();
    }
  }

  @Remote("folders")
  async folders(name: string): Promise<any> {
    const host = this.hostByName(name);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of [...(host.recent ?? []), host.cwd].filter(Boolean) as string[]) {
      if (seen.has(p)) continue;
      seen.add(p);
      out.push(p);
    }
    return { folders: out };
  }

  @Remote("rememberFolder")
  async rememberFolder(name: string, path: string): Promise<any> {
    const host = this.hostByName(name);
    const p = String(path ?? "").trim();
    if (!p) return { ok: false, error: "Empty path" };
    return { ok: true, recent: await this.rememberInto(host, p) };
  }

  @Remote("adoptFolder")
  async adoptFolder(name: string | null | undefined, path: string): Promise<any> {
    const chosen = String(path ?? "").trim();
    if (!chosen) return { ok: false, error: "No path chosen" };
    const host = name === null || name === undefined ? null : this.hostByName(name);
    let local = chosen;
    if (host) {
      if (!chosen.startsWith("/")) return { ok: false, error: "Absolute remote path required" };
      const mirrored = toMirror(this.mirrorRoot, host.name, chosen);
      if (!mirrored) return { ok: false, error: "Invalid path" };
      local = mirrored;
    }
    try {
      if (host) {
        await mkdir(local, { recursive: true });
      }
      const existing = await (this.ctx as any).workspaceRegistry.resolveByPath(local);
      const ws = existing ?? (await (this.ctx as any).workspaceRegistry.create(local));
      if (host) await this.rememberInto(host, chosen);
      this.log(`folder ${host ? host.name + ":" : ""}${chosen} -> workspace ${ws.title}`);
      return { ok: true, workspaceId: String(ws.id), path: local, remotePath: host ? chosen : null, title: ws.title };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e).slice(0, 300) };
    }
  }
}

export { DshSsh };
