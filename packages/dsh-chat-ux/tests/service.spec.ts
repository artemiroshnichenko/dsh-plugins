import { describe, it, expect, vi } from "vitest";
import { Context } from "@deepseek-ai/cordis";
import DshChatUx, { Config } from "../src/index.js";

describe("DshChatUx service", () => {
  it("validates config options", () => {
    const cfg = Config({
      enableRollback: true,
      enableFork: true,
      dedupSystemPrompts: false,
    });
    expect(cfg.enableRollback).toBe(true);
    expect(cfg.enableFork).toBe(true);
    expect(cfg.dedupSystemPrompts).toBe(false);
  });

  it("handles turn info queries with mock session", async () => {
    const ctx = new Context();
    const service = new DshChatUx(ctx, { enableRollback: true });

    const mockEvents = [
      { type: "session/start", seq: 0 },
      { type: "turn/start", seq: 1, data: { turn: 1 } },
      {
        type: "user/message",
        seq: 2,
        data: { content: [{ type: "text", text: "Test prompt 1" }] },
      },
      { type: "turn/end", seq: 3, data: { turn: 1 } },
    ];

    // Mock sessions service
    (ctx as any).sessions = {
      get: (id: string) => {
        if (id === "session-mock") {
          return {
            events: mockEvents,
            header: { id: "session-mock", cwd: "/tmp" },
          };
        }
        return undefined;
      },
    };

    const res = await service.getTurnInfo("session-mock", 1);
    expect(res.ok).toBe(true);
    expect(res.turn).toBe(1);
    expect(res.promptText).toBe("Test prompt 1");

    const notFound = await service.getTurnInfo("session-mock", 99);
    expect(notFound.ok).toBe(false);
  });

  it("forks before a user turn", async () => {
    const ctx = new Context();
    const service = new DshChatUx(ctx, { enableFork: true });

    const mockEvents = [
      { type: "session/start", seq: 0 },
      { type: "turn/start", seq: 1, data: { turn: 1 } },
      {
        type: "user/message",
        seq: 2,
        data: { content: [{ type: "text", text: "Prompt 1" }] },
      },
      { type: "turn/end", seq: 3, data: { turn: 1 } },
      { type: "turn/start", seq: 4, data: { turn: 2 } },
      {
        type: "user/message",
        seq: 5,
        data: { content: [{ type: "text", text: "Prompt 2" }] },
      },
    ];

    let createdSessionOpts: any = null;

    (ctx as any).sessions = {
      get: (id: string) => ({
        events: mockEvents,
        header: { id: "session-1", cwd: "/test/dir" },
      }),
    };

    (ctx as any).agents = {
      create: async (opts: any) => {
        createdSessionOpts = opts;
      },
    };

    const result = await service.forkBeforeTurn("session-1", 2);
    expect(result.ok).toBe(true);
    expect(result.promptText).toBe("Prompt 2");
    expect(result.childSessionId).toMatch(/^session-/);

    expect(createdSessionOpts).toBeDefined();
    expect(createdSessionOpts.meta.parentSession).toBe("session-1");
    expect(createdSessionOpts.meta.cwd).toBe("/test/dir");
    expect(createdSessionOpts.seed.length).toBe(4); // Up to seq 3
    expect(createdSessionOpts.seed.map((e: any) => e.seq)).toEqual([0, 1, 2, 3]);
  });
});
