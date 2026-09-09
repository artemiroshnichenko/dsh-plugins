import { describe, it, expect } from "vitest";
import { RemoteDriver } from "../src/remote.js";
import type { NormalizedHost } from "../src/types.js";

function harness() {
  const appended: { t: string; d: any; s?: any }[] = [];
  const calls: any[][] = [];
  const session = {
    id: "s1",
    header: { cwd: "/w" },
    append: (t: string, d: any, s?: any) => appended.push({ t, d, s }),
  };
  const ctx: any = {
    sessions: {
      prepare: (id: string, o: any) => {
        calls.push(["prepare", id, o?.meta?.cwd]);
        return { session, [Symbol.dispose]: () => calls.push(["prep-dispose"]) };
      },
      enter: () => {
        calls.push(["sessions.enter"]);
        return () => calls.push(["sessions.detach"]);
      },
      announce: () => calls.push(["sessions.announce"]),
    },
    agents: {
      enter: () => {
        calls.push(["agents.enter"]);
        return () => calls.push(["agents.detach"]);
      },
      announce: () => calls.push(["agents.announce"]),
    },
    approval: { request: async () => ctx.__outcome ?? "allowed-once" },
    __outcome: undefined,
  };
  const conn: any = {
    initialize: async () => ({ agentInfo: { name: "acp" } }),
    newSession: async (cwd: string) => {
      calls.push(["newSession", cwd]);
      return { sessionId: "R1" };
    },
    resumeSession: async (id: string) => calls.push(["resumeSession", id]),
    prompt: async () => {
      calls.push(["prompt"]);
      return { stopReason: "end_turn" };
    },
    cancel: () => calls.push(["cancel"]),
    closeSession: async () => calls.push(["closeSession"]),
  };
  const driver = new RemoteDriver({ ctx, connectionFor: async () => conn, log: () => {} });
  return { driver, ctx, conn, appended, calls, session };
}

const HOST: NormalizedHost = {
  name: "staging",
  ssh: "staging",
  port: null,
  identityFile: null,
  cwd: "/home/ubuntu/workspace",
  remotePath: "$HOME/.agents/bin:$PATH",
  profile: "acp",
  recent: [],
  source: "user",
};

describe("remote", () => {
  it("maintains agent and session creation transaction order", async () => {
    const h = harness();
    const { agent } = await h.driver.createAgent({}, { sessionId: "s1", meta: {} }, HOST);
    const order = h.calls.map((c) => c[0]);
    expect(order.slice(0, 6)).toEqual([
      "newSession",
      "prepare",
      "sessions.enter",
      "agents.enter",
      "sessions.announce",
      "agents.announce",
    ]);
    expect(agent.remoteSessionId).toBe("R1");
    expect(agent.status).toBe("idle");
  });

  it("uses remote working directory without local meta.cwd overriding it", async () => {
    const a = harness();
    await a.driver.createAgent({}, { sessionId: "s1", meta: { cwd: "/Users/dev/notes" } }, HOST);
    expect(a.calls.find((c) => c[0] === "newSession")).toEqual(["newSession", "/home/ubuntu/workspace"]);
    expect(a.calls.find((c) => c[0] === "prepare")).toEqual(["prepare", "s1", "/Users/dev/notes"]);
  });

  it("throws clear error when no remote working directory is available", async () => {
    const h = harness();
    await expect(
      h.driver.createAgent(
        {},
        { sessionId: "s1", meta: {} },
        { ...HOST, cwd: null }
      )
    ).rejects.toThrow(/no working directory specified/);
  });

  it("appends remote updates to local session log", async () => {
    const h = harness();
    await h.driver.createAgent({}, { sessionId: "s1", meta: {} }, HOST);
    h.driver.onUpdate("R1", { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "done" } });
    h.driver.onUpdate("R1", {
      sessionUpdate: "tool_call",
      toolCallId: "t1",
      title: "bash",
      rawInput: { command: "ls" },
    });
    h.driver.onUpdate("R1", {
      sessionUpdate: "tool_call_update",
      toolCallId: "t1",
      status: "completed",
      content: "ok",
    });
    expect(h.appended.map((a) => a.t)).toEqual(["assistant/chunk", "tool/call", "tool/result"]);
    expect(h.appended[2].s).toEqual({ surfaceOp: "append" });
  });

  it("ignores updates for unknown remote session ids", async () => {
    const h = harness();
    await h.driver.createAgent({}, { sessionId: "s1", meta: {} }, HOST);
    h.driver.onUpdate("OTHER", {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "alien" },
    });
    expect(h.appended.length).toBe(0);
  });

  it("records user message and returns to idle when prompt finishes", async () => {
    const h = harness();
    const { agent } = await h.driver.createAgent({}, { sessionId: "s1", meta: {} }, HOST);
    agent.send({ content: "build project" });
    expect(agent.status).toBe("running");
    expect(h.appended[0].t).toBe("user/message");
    await agent.whenIdle();
    expect(h.calls.some((c) => c[0] === "prompt")).toBe(true);
    expect(agent.status).toBe("idle");
  });

  it("does not dispatch empty prompts", async () => {
    const h = harness();
    const { agent } = await h.driver.createAgent({}, { sessionId: "s1", meta: {} }, HOST);
    agent.send({ content: "   " });
    expect(agent.status).toBe("idle");
    expect(h.calls.filter((c) => c[0] === "prompt").length).toBe(0);
  });

  it("closes pending tool calls when connection is lost", async () => {
    const h = harness();
    await h.driver.createAgent({}, { sessionId: "s1", meta: {} }, HOST);
    h.driver.onUpdate("R1", { sessionUpdate: "tool_call", toolCallId: "t1", title: "bash" });
    h.driver.onConnectionLost(HOST, "ssh failure");
    const last = h.appended.at(-1)!;
    expect(last.t).toBe("tool/result");
    expect(last.d.ok).toBe(false);
    expect(last.d.content).toContain("ssh failure");
  });

  it("maps approval responses to optionId", async () => {
    const h = harness();
    await h.driver.createAgent({}, { sessionId: "s1", meta: {} }, HOST);
    const params = {
      sessionId: "R1",
      toolCall: { toolCallId: "t1", title: "bash" },
      options: [
        { optionId: "allow-once", kind: "allow_once" },
        { optionId: "reject-once", kind: "reject_once" },
      ],
    };
    expect(await h.driver.onPermission(params)).toBe("allow-once");
    h.ctx.__outcome = "rejected";
    expect(await h.driver.onPermission(params)).toBe("reject-once");
  });

  it("rejects permission if session or approval capability is absent", async () => {
    const h = harness();
    await h.driver.createAgent({}, { sessionId: "s1", meta: {} }, HOST);
    expect(await h.driver.onPermission({ sessionId: "NON_EXISTENT", options: [] })).toBe("reject-once");
    delete h.ctx.approval;
    expect(await h.driver.onPermission({ sessionId: "R1", options: [] })).toBe("reject-once");
  });

  it("cleans up session and detaches agents on dispose", async () => {
    const h = harness();
    const handle = await h.driver.createAgent({}, { sessionId: "s1", meta: {} }, HOST);
    await handle.dispose();
    const order = h.calls.map((c) => c[0]);
    expect(order).toContain("closeSession");
    expect(order.indexOf("agents.detach")).toBeLessThan(order.indexOf("sessions.detach"));
    h.driver.onUpdate("R1", {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "too-late" },
    });
    expect(h.appended.length).toBe(0);
  });

  it("resumes existing remote sessions", async () => {
    const h = harness();
    const { agent } = await h.driver.resume({}, { resumeSessionId: "R9", meta: { cwd: "/w" } }, HOST);
    expect(h.calls.find((c) => c[0] === "resumeSession")).toEqual(["resumeSession", "R9"]);
    expect(agent.remoteSessionId).toBe("R9");
  });

  it("tracks host associated with active sessions", async () => {
    const h = harness();
    await h.driver.createAgent({}, { sessionId: "s1", meta: {} }, HOST);
    expect(h.driver.hostOf("s1")?.name).toBe("staging");
    expect(h.driver.hostOf("other")).toBeUndefined();
    expect(h.driver.hostOf(undefined)).toBeUndefined();
    expect(h.driver.hostOf(null as any)).toBeUndefined();
  });

  it("forgets host after session disposal", async () => {
    const h = harness();
    const handle = await h.driver.createAgent({}, { sessionId: "s1", meta: {} }, HOST);
    await handle.dispose();
    expect(h.driver.hostOf("s1")).toBeUndefined();
  });
});
