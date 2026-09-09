import { spawn, type ChildProcess } from "node:child_process";
import { reapCommand, sshArgs, sshPlainArgs, PID_MARK } from "./hosts.js";
import type { ClassifiedMessage, NormalizedHost } from "./types.js";

export class LineDecoder {
  #buf = "";

  push(chunk: string): unknown[] {
    this.#buf += chunk;
    const out: unknown[] = [];
    let i: number;
    while ((i = this.#buf.indexOf("\n")) >= 0) {
      const line = this.#buf.slice(0, i).trim();
      this.#buf = this.#buf.slice(i + 1);
      if (!line) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        // non-JSON stream noise is skipped
      }
    }
    return out;
  }

  get pending(): number {
    return this.#buf.length;
  }
}

export function classify(msg: any): ClassifiedMessage {
  if (msg == null || typeof msg !== "object") return { kind: "junk" };
  if (msg.id !== undefined && typeof msg.method === "string") {
    return { kind: "request", id: msg.id, method: msg.method, params: msg.params };
  }
  if (msg.id !== undefined) {
    return { kind: "response", id: msg.id, error: msg.error, result: msg.result };
  }
  if (typeof msg.method === "string") {
    return { kind: "notification", method: msg.method, params: msg.params };
  }
  return { kind: "junk" };
}

export const NO_ADAPTER_RE = /no adapter registered for provider/i;

export function isStartupRace(error: unknown): boolean {
  return error instanceof AcpError && NO_ADAPTER_RE.test(String(error.message));
}

export class AcpError extends Error {
  code?: number;
  method?: string;

  constructor(payload: any, method?: string) {
    const base = typeof payload?.message === "string" ? payload.message : JSON.stringify(payload);
    const extra = payload?.data ? ` | ${JSON.stringify(payload.data).slice(0, 200)}` : "";
    super(method ? `${method}: ${base}${extra}` : `${base}${extra}`);
    this.name = "AcpError";
    this.code = payload?.code;
    this.method = method;
  }
}

export interface AcpHandlers {
  onPermission: (params: any) => Promise<string>;
  onUpdate?: (sessionId: string, update: any) => void;
  onClosed?: (reason: string) => void;
  onStderr?: (line: string) => void;
}

interface PendingRequest {
  res: (value: any) => void;
  rej: (reason: any) => void;
  method: string;
}

export class AcpConnection {
  #child: ChildProcess | null = null;
  #dec = new LineDecoder();
  #pending = new Map<number | string, PendingRequest>();
  #nextId = 1;
  #closed = false;
  #h: AcpHandlers;
  #host: NormalizedHost;
  #remotePid: string | null = null;

  constructor(host: NormalizedHost, handlers: AcpHandlers) {
    this.#host = host;
    this.#h = handlers;
  }

  get host(): NormalizedHost {
    return this.#host;
  }

  get closed(): boolean {
    return this.#closed;
  }

  static reapStale(host: NormalizedHost): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      try {
        const p = spawn("ssh", sshPlainArgs(host, reapCommand(host)), { stdio: "ignore" });
        p.on("exit", finish);
        p.on("error", finish);
        setTimeout(finish, 15000).unref?.();
      } catch {
        finish();
      }
    });
  }

  start(): this {
    if (this.#child) throw new Error("acp: connection already started");
    const child = spawn("ssh", sshArgs(this.#host), { stdio: ["pipe", "pipe", "pipe"] });
    this.#child = child;
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (c: string) => {
      for (const m of this.#dec.push(c)) this.#dispatch(m);
    });

    child.stderr?.on("data", (c: string) => {
      const s = String(c);
      const m = s.match(new RegExp(PID_MARK + "(\\d+)"));
      if (m) this.#remotePid = m[1];
      const rest = s
        .split("\n")
        .filter((l) => l && !l.includes(PID_MARK))
        .join("\n")
        .trimEnd();
      if (rest) this.#h.onStderr?.(rest);
    });

    child.on("exit", (code, signal) => this.#fail(`ssh exited: code=${code} signal=${signal}`));
    child.on("error", (e) => this.#fail(`ssh failed to spawn: ${e.message}`));
    return this;
  }

  #fail(reason: string) {
    if (this.#closed) return;
    this.#closed = true;
    for (const { rej } of this.#pending.values()) rej(new Error(reason));
    this.#pending.clear();
    this.#h.onClosed?.(reason);
  }

  #send(msg: any) {
    if (this.#closed || !this.#child?.stdin) throw new Error("acp: connection closed");
    this.#child.stdin.write(JSON.stringify(msg) + "\n");
  }

  request(method: string, params?: any): Promise<any> {
    const id = this.#nextId++;
    const p = new Promise((res, rej) => this.#pending.set(id, { res, rej, method }));
    this.#send({ jsonrpc: "2.0", id, method, params });
    return p;
  }

  notify(method: string, params?: any) {
    this.#send({ jsonrpc: "2.0", method, params });
  }

  async #dispatch(msg: any) {
    const m = classify(msg);
    if (m.kind === "response") {
      const p = this.#pending.get(m.id);
      if (!p) return;
      this.#pending.delete(m.id);
      if (m.error) {
        p.rej(new AcpError(m.error, p.method));
      } else {
        p.res(m.result);
      }
      return;
    }
    if (m.kind === "notification") {
      if (m.method === "session/update") {
        this.#h.onUpdate?.((m.params as any)?.sessionId, (m.params as any)?.update ?? {});
      }
      return;
    }
    if (m.kind === "request") {
      if (m.method === "session/request_permission") {
        try {
          const optionId = await this.#h.onPermission(m.params);
          this.#send({ jsonrpc: "2.0", id: m.id, result: { outcome: { outcome: "selected", optionId } } });
        } catch {
          this.#send({ jsonrpc: "2.0", id: m.id, result: { outcome: { outcome: "cancelled" } } });
        }
        return;
      }
      this.#send({
        jsonrpc: "2.0",
        id: m.id,
        error: { code: -32601, message: `method not supported by dsh-ssh: ${m.method}` },
      });
    }
  }

  async initialize(): Promise<any> {
    return this.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
    });
  }

  async newSession(cwd?: string, { attempts = 5, delayMs = 600 } = {}): Promise<any> {
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.request("session/new", { cwd, mcpServers: [] });
      } catch (e) {
        if (!isStartupRace(e) || this.closed) throw e;
        last = e;
        this.#h.onStderr?.(`acp bridge starting up, retry attempt ${i + 2} of ${attempts}`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    throw last;
  }

  resumeSession(sessionId: string): Promise<any> {
    return this.request("session/resume", { sessionId });
  }

  listSessions(cwd?: string): Promise<any> {
    return this.request("session/list", cwd ? { cwd } : {});
  }

  prompt(sessionId: string, text: string): Promise<any> {
    return this.request("session/prompt", { sessionId, prompt: [{ type: "text", text }] });
  }

  cancel(sessionId: string): void {
    this.notify("session/cancel", { sessionId });
  }

  closeSession(sessionId: string): Promise<any> {
    return this.request("session/close", { sessionId });
  }

  #reapRemote() {
    const pid = this.#remotePid;
    this.#remotePid = null;
    const script = pid
      ? `kill -TERM -${pid} 2>/dev/null; kill ${pid} 2>/dev/null; ${reapCommand(this.#host)}`
      : reapCommand(this.#host);
    try {
      spawn("ssh", sshPlainArgs(this.#host, script), { stdio: "ignore", detached: true }).unref();
    } catch {
      // ignore
    }
  }

  dispose() {
    if (this.#closed) return;
    this.#closed = true;
    try {
      this.#child?.stdin?.end();
    } catch {
      // ignore
    }
    const child = this.#child;
    setTimeout(() => {
      try {
        child?.kill();
      } catch {
        // ignore
      }
      this.#reapRemote();
    }, 500).unref?.();
    for (const { rej } of this.#pending.values()) {
      rej(new Error("acp: connection closed by caller"));
    }
    this.#pending.clear();
  }
}
