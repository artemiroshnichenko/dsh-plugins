import { describe, it, expect } from "vitest";
import { contextWithCapturingFactory, RoutingFactory, makeRouter } from "../src/factory.js";

const fakeCtx = () => {
  const effects: string[] = [];
  const registry = {
    live: new Map<string, any>(),
    setFactory() {
      throw new Error("slot already occupied");
    },
    create() {
      return "real create";
    },
    enter(agent: any) {
      this.live.set(agent.id, agent);
      return () => this.live.delete(agent.id);
    },
    get(id: string) {
      return this.live.get(id);
    },
  };
  return {
    fiber: "F",
    effect: (fn: any, label: string) => {
      effects.push(label);
      return fn();
    },
    agents: registry,
    systemPrompt: { variable: () => {} },
    __effects: effects,
    __registry: registry,
  };
};

describe("factory", () => {
  it("intercepts setFactory without calling real registry", () => {
    const ctx = fakeCtx();
    let captured: any = null;
    const proxy = contextWithCapturingFactory(ctx as any, (f) => {
      captured = f;
    });
    const dispose = (proxy as any).agents.setFactory({ mark: "loop" });
    expect(captured).toEqual({ mark: "loop" });
    dispose();
    expect(captured).toBeNull();
  });

  it("preserves agent registry targets and keeps methods bound to original", () => {
    const ctx = fakeCtx();
    const proxy = contextWithCapturingFactory(ctx as any, () => {});
    const agent = { id: "a1" };
    (proxy as any).agents.enter(agent);
    expect(ctx.__registry.live.get("a1")).toBe(agent);
    expect((ctx as any).agents.get("a1")).toBe(agent);
    expect((proxy as any).agents.get("a1")).toBe(agent);
  });

  it("leaves the rest of the context intact", () => {
    const ctx = fakeCtx();
    const proxy = contextWithCapturingFactory(ctx as any, () => {});
    expect((proxy as any).fiber).toBe("F");
    expect((proxy as any).agents.create()).toBe("real create");
    (proxy as any).effect(() => {}, "test-label");
    expect(ctx.__effects).toEqual(["test-label"]);
  });

  it("does not mutate the original context", () => {
    const ctx = fakeCtx();
    contextWithCapturingFactory(ctx as any, () => {});
    expect(() => (ctx as any).agents.setFactory({})).toThrow(/slot already occupied/);
  });

  const holder = {
    factory: {
      createAgent: async () => "local",
      resume: async () => "local-resume",
    },
  };
  const remote = {
    createAgent: async (_c: any, _o: any, t: any) => `remote:${t.name}`,
    resume: async (_c: any, _o: any, t: any) => `remote-resume:${t.name}`,
  };

  it("routes sessions to local factory when no target specified", async () => {
    const f = new RoutingFactory(holder, remote, () => null);
    expect(await f.createAgent({} as any, { sessionId: "s1" })).toBe("local");
    expect(await f.resume({} as any, { resumeSessionId: "s1" })).toBe("local-resume");
  });

  it("routes sessions to remote driver when target specified", async () => {
    const f = new RoutingFactory(holder, remote, () => ({ name: "staging" } as any));
    expect(await f.createAgent({} as any, { sessionId: "s2" })).toBe("remote:staging");
  });

  it("falls back to local when routing throws", async () => {
    const f = new RoutingFactory(holder, remote, () => {
      throw new Error("broken registry");
    });
    expect(await f.createAgent({} as any, { sessionId: "s3" })).toBe("local");
  });

  it("prioritizes pinned session host over pending target", () => {
    const targets = {
      bySession: new Map([["s1", { name: "staging" } as any]]),
      pending: { name: "production" } as any,
    };
    const route = makeRouter(targets);
    expect(route({ sessionId: "s1" })?.name).toBe("staging");
    expect(route({ sessionId: "new" })?.name).toBe("production");
    targets.pending = null;
    expect(route({ sessionId: "new" })).toBeNull();
  });

  it("resolves resume targets by resumeSessionId", () => {
    const targets = { bySession: new Map([["s9", { name: "staging" } as any]]), pending: null };
    expect(makeRouter(targets)({ resumeSessionId: "s9" })?.name).toBe("staging");
  });

  it("throws clear error when local factory is not yet captured", async () => {
    const empty = { factory: null };
    const f = new RoutingFactory(empty, remote, () => null);
    await expect(f.createAgent({} as any, { sessionId: "s0" })).rejects.toThrow(
      /standard AgentLoop factory not ready/
    );
  });

  it("works once local factory becomes available", async () => {
    const late: { factory: any } = { factory: null };
    const f = new RoutingFactory(late, remote, () => null);
    late.factory = { createAgent: async () => "late-local" };
    expect(await f.createAgent({} as any, { sessionId: "s1" })).toBe("late-local");
  });

  it("prefers workspace folder host over pending target", () => {
    const staging = { name: "staging" } as any;
    const targets = { bySession: new Map(), pending: null };
    const byFolder = (cwd: string) => (cwd.includes("/remote/staging/") ? staging : null);
    const route = makeRouter(targets, byFolder);
    expect(route({ sessionId: "s1", meta: { cwd: "/Users/me/.dsh/remote/staging/srv/app" } })?.name).toBe(
      "staging"
    );

    targets.pending = { name: "production" } as any;
    expect(route({ sessionId: "s2", meta: { cwd: "/Users/me/.dsh/remote/staging/srv/app" } })?.name).toBe(
      "staging"
    );
  });

  it("does not let local workspace folder cancel pending target", () => {
    const targets = { bySession: new Map(), pending: { name: "staging" } as any };
    const route = makeRouter(targets, () => null);
    expect(route({ sessionId: "s3", meta: { cwd: "/Users/me/projects" } })?.name).toBe("staging");
  });
});
