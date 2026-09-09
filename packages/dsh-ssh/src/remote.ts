import type { Context } from "@deepseek-ai/cordis";
import { emitAgentEvent } from "@deepseek-ai/dsh-agent";
import type { AcpConnection } from "./acp.js";
import type { NormalizedHost } from "./types.js";
import { danglingResults, newUpdateState, toSessionEvents, type UpdateState } from "./updates.js";

export class RemoteAgent {
  ctx: Context;
  id: string;
  options: Record<string, unknown>;
  session: any;
  host: NormalizedHost;
  #conn: AcpConnection;
  #remoteSessionId: string;
  #state: UpdateState = newUpdateState();
  #idle: (() => void)[] = [];
  #status = "idle";
  #log: (msg: string) => void;
  inbox: {
    append: () => void;
    prepend: () => void;
    clear: () => void;
    claim: () => unknown[];
  };

  constructor({
    ctx,
    id,
    options,
    session,
    conn,
    remoteSessionId,
    host,
    log,
  }: {
    ctx: Context;
    id: string;
    options?: Record<string, unknown>;
    session: any;
    conn: AcpConnection;
    remoteSessionId: string;
    host: NormalizedHost;
    log: (msg: string) => void;
  }) {
    this.ctx = ctx;
    this.id = id;
    this.options = options ?? {};
    this.session = session;
    this.host = host;
    this.#conn = conn;
    this.#remoteSessionId = remoteSessionId;
    this.#log = log;
    this.inbox = {
      append: () => {},
      prepend: () => {},
      clear: () => {},
      claim: () => [],
    };
  }

  get status(): string {
    return this.#status;
  }

  get remoteSessionId(): string {
    return this.#remoteSessionId;
  }

  get updateState(): UpdateState {
    return this.#state;
  }

  #setStatus(s: string) {
    if (this.#status === s) return;
    this.#status = s;
    try {
      (emitAgentEvent as any)(this.ctx, this, "agent/status", { status: s });
    } catch {
      // non-critical
    }
    if (s === "idle") {
      for (const r of this.#idle.splice(0)) r();
    }
  }

  applyUpdate(update: any) {
    for (const e of toSessionEvents(update, this.#state)) {
      try {
        this.session.append(e.type, e.data, ...(e.surface ? [e.surface] : []));
      } catch (err: any) {
        this.#log(`event ${e.type} failed to append to session log: ${err.message}`);
      }
    }
  }

  connectionLost(reason: string) {
    for (const e of danglingResults(this.#state, reason)) {
      try {
        this.session.append(e.type, e.data, e.surface);
      } catch {
        // session might already be closed
      }
    }
    this.#setStatus("idle");
  }

  #textOf(message: any): string {
    const c = message?.content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) return c.map((b: any) => (b?.type === "text" ? b.text : "")).join("");
    return String(message?.text ?? "");
  }

  send(message: any) {
    const text = this.#textOf(message);
    if (!text.trim()) return;
    try {
      this.session.append("user/message", { message }, { surfaceOp: "append" });
    } catch (e: any) {
      this.#log(`prompt failed to record in session log: ${e.message}`);
    }
    this.#setStatus("running");
    this.#conn
      .prompt(this.#remoteSessionId, text)
      .catch((e: any) => {
        this.#log(`remote execution on ${this.host.name} failed: ${e.message}`);
        this.connectionLost(`execution aborted: ${e.message}`);
      })
      .finally(() => this.#setStatus("idle"));
  }

  followup(m: any) {
    this.send(m);
  }

  steer(m: any) {
    this.send(m);
  }

  inject(m: any) {
    this.send(m);
  }

  cancel() {
    try {
      this.#conn.cancel(this.#remoteSessionId);
    } catch {
      // connection already closed
    }
    this.#setStatus("idle");
  }

  runMaintenance() {}

  whenIdle(): Promise<void> {
    if (this.#status === "idle") return Promise.resolve();
    return new Promise((res) => this.#idle.push(res));
  }

  async dispose(): Promise<void> {
    try {
      await this.#conn.closeSession(this.#remoteSessionId);
    } catch {
      // host might be unreachable
    }
  }
}

export class RemoteDriver {
  #ctx: Context;
  #connectionFor: (host: NormalizedHost) => Promise<AcpConnection>;
  #log: (msg: string) => void;
  #remoteCwd: (options: any, host: NormalizedHost) => string | null;
  #byRemoteId = new Map<string, RemoteAgent>();
  #byHost = new Map<string, Set<RemoteAgent>>();

  constructor({
    ctx,
    connectionFor,
    log,
    remoteCwd,
  }: {
    ctx: Context;
    connectionFor: (host: NormalizedHost) => Promise<AcpConnection>;
    log: (msg: string) => void;
    remoteCwd?: (options: any, host: NormalizedHost) => string | null;
  }) {
    this.#ctx = ctx;
    this.#connectionFor = connectionFor;
    this.#log = log;
    this.#remoteCwd = remoteCwd ?? ((_options, host) => host.cwd);
  }

  hostOf(localSessionId?: string): NormalizedHost | undefined {
    if (!localSessionId) return undefined;
    for (const agent of this.#byRemoteId.values()) {
      if (String(agent.id) === String(localSessionId)) return agent.host;
    }
    return undefined;
  }

  onUpdate(remoteSessionId: string, update: any) {
    this.#byRemoteId.get(String(remoteSessionId))?.applyUpdate(update);
  }

  onConnectionLost(host: NormalizedHost, why: string) {
    for (const a of this.#byHost.get(host.name) ?? []) a.connectionLost(why);
    this.#byHost.delete(host.name);
  }

  async onPermission(params: any): Promise<string> {
    const allow = (params?.options ?? []).find((o: any) => o.kind === "allow_once")?.optionId ?? "allow-once";
    const reject = (params?.options ?? []).find((o: any) => o.kind === "reject_once")?.optionId ?? "reject-once";
    const agent = this.#byRemoteId.get(String(params?.sessionId));
    if (!agent || !(this.#ctx as any).approval) return reject;
    try {
      const outcome = await (this.#ctx as any).approval.request({
        agent,
        toolName: params?.toolCall?.title ?? "remote tool",
        callId: params?.toolCall?.toolCallId,
        reason: `Remote agent on ${agent.host.name} requested permission`,
      });
      return outcome === "allowed-once" ? allow : reject;
    } catch (e: any) {
      this.#log(`permission request failed: ${e.message}`);
      return reject;
    }
  }

  #track(agent: RemoteAgent, host: NormalizedHost) {
    this.#byRemoteId.set(String(agent.remoteSessionId), agent);
    if (!this.#byHost.has(host.name)) this.#byHost.set(host.name, new Set());
    this.#byHost.get(host.name)!.add(agent);
  }

  async #publish(ownerCtx: Context, options: any, host: NormalizedHost, remoteSessionId: string) {
    const id = options.sessionId ?? options.resumeSessionId;
    const preparation = (this.#ctx as any).sessions.prepare(id, { meta: options.meta ?? {} });
    const session = preparation.session ?? preparation;
    const conn = await this.#connectionFor(host);

    const agent = new RemoteAgent({
      ctx: this.#ctx,
      id,
      options: options.agentOptions ?? {},
      session,
      conn,
      remoteSessionId,
      host,
      log: this.#log,
    });

    const detachSession = (this.#ctx as any).sessions.enter(session);
    const detachAgent = (this.#ctx as any).agents.enter(agent, (ownerCtx as any)?.agent);
    (this.#ctx as any).sessions.announce(session);
    (this.#ctx as any).agents.announce(agent);
    try {
      (emitAgentEvent as any)(this.#ctx, agent, "agent/session-start", { source: "startup" });
    } catch {
      // ignore
    }
    this.#track(agent, host);

    return {
      agent,
      dispose: async () => {
        this.#byRemoteId.delete(String(remoteSessionId));
        this.#byHost.get(host.name)?.delete(agent);
        await agent.dispose();
        try {
          detachAgent();
        } finally {
          detachSession();
        }
        preparation[Symbol.dispose]?.();
      },
    };
  }

  async createAgent(ownerCtx: Context, options: any, host: NormalizedHost): Promise<any> {
    const conn = await this.#connectionFor(host);
    await conn.initialize();
    const cwd = this.#remoteCwd(options, host);
    if (!cwd) {
      throw new Error(`dsh-ssh: no working directory specified for ${host.name}`);
    }
    const { sessionId: remoteSessionId } = await conn.newSession(cwd);
    this.#log(`${host.name}: remote session ${String(remoteSessionId).slice(0, 8)} in ${cwd}`);
    return this.#publish(ownerCtx, options, host, remoteSessionId);
  }

  async resume(ownerCtx: Context, options: any, host: NormalizedHost): Promise<any> {
    const conn = await this.#connectionFor(host);
    await conn.initialize();
    const remoteSessionId = options.remoteSessionId ?? options.resumeSessionId;
    await conn.resumeSession(remoteSessionId);
    return this.#publish(ownerCtx, options, host, remoteSessionId);
  }
}
