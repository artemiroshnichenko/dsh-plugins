import type { Context } from "@deepseek-ai/cordis";
import type { NormalizedHost } from "./types.js";

export function contextWithCapturingFactory(ctx: Context, capture: (factory: any) => void): Context {
  const registry = (ctx as any).agents;
  const agents = new Proxy(registry, {
    get(target, prop) {
      if (prop === "setFactory") {
        return (factory: any) => {
          capture(factory);
          return () => capture(null);
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const proxy = Object.create(ctx);
  Object.defineProperty(proxy, "agents", { value: agents, enumerable: true, configurable: true });
  return proxy;
}

export interface LocalFactoryHolder {
  factory: any | null;
}

export class RoutingFactory {
  #local: LocalFactoryHolder;
  #remote: any;
  #route: (options: any) => NormalizedHost | null;
  #log: (msg: string) => void;

  constructor(
    local: LocalFactoryHolder,
    remote: any,
    route: (options: any) => NormalizedHost | null,
    log: (msg: string) => void = () => {}
  ) {
    this.#local = local;
    this.#remote = remote;
    this.#route = route;
    this.#log = log;
  }

  #localFactory() {
    const f = this.#local.factory;
    if (!f) throw new Error("dsh-ssh: standard AgentLoop factory not ready yet");
    return f;
  }

  async createAgent(ownerCtx: Context, options: any): Promise<any> {
    let target: NormalizedHost | null = null;
    try {
      target = this.#route(options);
    } catch (e: any) {
      this.#log(`routing error, falling back to local: ${e.message}`);
    }
    if (!target) return this.#localFactory().createAgent(ownerCtx, options);
    try {
      this.#log(`session ${String(options.sessionId).slice(0, 8)} routed to ${target.name}`);
      return await this.#remote.createAgent(ownerCtx, options, target);
    } catch (e: any) {
      this.#log(`remote session on ${target.name} failed: ${e.message}`);
      throw new Error(`Failed to create remote session on ${target.name}: ${e.message}`, { cause: e });
    }
  }

  async resume(ownerCtx: Context, options: any): Promise<any> {
    let target: NormalizedHost | null = null;
    try {
      target = this.#route(options);
    } catch {
      // fallback
    }
    if (!target) return this.#localFactory().resume(ownerCtx, options);
    return this.#remote.resume(ownerCtx, options, target);
  }
}

export interface TargetTracker {
  bySession: Map<string, NormalizedHost>;
  pending: NormalizedHost | null;
}

export function makeRouter(
  targets: TargetTracker,
  byFolder: (cwd: string) => NormalizedHost | null = () => null
): (options: any) => NormalizedHost | null {
  return (options: any) => {
    const cwd = options?.meta?.cwd;
    if (cwd) {
      const host = byFolder(cwd);
      if (host) return host;
    }
    const id = options?.sessionId ?? options?.resumeSessionId;
    if (id && targets.bySession.has(String(id))) return targets.bySession.get(String(id))!;
    return targets.pending ?? null;
  };
}
