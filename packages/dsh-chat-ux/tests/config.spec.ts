import { describe, it, expect } from "vitest";
import { Config } from "../src/index.js";

describe("dsh-chat-ux config schema", () => {
  it("provides sensible defaults", () => {
    const validated = Config({});
    expect(validated.dedupSystemPrompts).toBe(true);
    expect(validated.pageByTurn).toBe(true);
  });

  it("respects custom config", () => {
    const validated = Config({
      dedupSystemPrompts: false,
      pageByTurn: false,
    });
    expect(validated.dedupSystemPrompts).toBe(false);
    expect(validated.pageByTurn).toBe(false);
  });
});
