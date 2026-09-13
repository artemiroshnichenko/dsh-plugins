import { describe, it, expect } from "vitest";
import {
  findTurnStartIndex,
  findTurnEndIndex,
  extractUserPrompt,
  cutBeforeTurn,
  cutAfterTurn,
  type EventEnvelope,
} from "../src/turns.js";

const sampleEvents: EventEnvelope[] = [
  { type: "session/start", seq: 0, time: 1000 },
  { type: "system/prompt", seq: 1, time: 1001 },
  // Turn 1
  { type: "turn/start", seq: 2, time: 1002, data: { turn: 1 } },
  {
    type: "user/message",
    seq: 3,
    time: 1003,
    data: {
      content: [{ type: "text", text: "Hello, first turn prompt" }],
    },
  },
  { type: "assistant/message", seq: 4, time: 1004, data: { text: "First reply" } },
  { type: "turn/end", seq: 5, time: 1005, data: { turn: 1 } },
  // Turn 2
  { type: "turn/start", seq: 6, time: 1006, data: { turn: 2 } },
  {
    type: "user/message",
    seq: 7,
    time: 1007,
    data: {
      content: [{ type: "text", text: "Second turn prompt" }],
    },
  },
  { type: "assistant/message", seq: 8, time: 1008, data: { text: "Second reply" } },
  { type: "turn/end", seq: 9, time: 1009, data: { turn: 2 } },
  // Turn 3
  { type: "turn/start", seq: 10, time: 1010, data: { turn: 3 } },
  {
    type: "user/message",
    seq: 11,
    time: 1011,
    data: {
      content: [{ type: "text", text: "Third turn prompt" }],
    },
  },
];

describe("turns inspection and cutting", () => {
  it("finds turn/start and turn/end indices correctly", () => {
    expect(findTurnStartIndex(sampleEvents, 1)).toBe(2);
    expect(findTurnEndIndex(sampleEvents, 1)).toBe(5);

    expect(findTurnStartIndex(sampleEvents, 2)).toBe(6);
    expect(findTurnEndIndex(sampleEvents, 2)).toBe(9);

    expect(findTurnStartIndex(sampleEvents, 3)).toBe(10);
    expect(findTurnEndIndex(sampleEvents, 3)).toBe(-1); // Turn 3 not ended yet

    expect(findTurnStartIndex(sampleEvents, 99)).toBe(-1);
  });

  it("extracts user prompt text correctly", () => {
    const prompt1 = extractUserPrompt(sampleEvents, 2);
    expect(prompt1).toBe("Hello, first turn prompt");

    const prompt2 = extractUserPrompt(sampleEvents, 6);
    expect(prompt2).toBe("Second turn prompt");

    const prompt3 = extractUserPrompt(sampleEvents, 10);
    expect(prompt3).toBe("Third turn prompt");

    expect(extractUserPrompt(sampleEvents, -1)).toBe("");
  });

  it("cuts before turn 2 correctly", () => {
    const res = cutBeforeTurn(sampleEvents, 2);
    expect(res.promptText).toBe("Second turn prompt");
    expect(res.keptEvents.length).toBe(6);
    expect(res.keptEvents.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("cuts before turn 1 correctly", () => {
    const res = cutBeforeTurn(sampleEvents, 1);
    expect(res.promptText).toBe("Hello, first turn prompt");
    expect(res.keptEvents.length).toBe(2);
    expect(res.keptEvents.map((e) => e.seq)).toEqual([0, 1]);
  });

  it("throws when cutting before non-existent turn", () => {
    expect(() => cutBeforeTurn(sampleEvents, 99)).toThrow("Turn 99 not found");
  });

  it("cuts after turn 1 correctly", () => {
    const res = cutAfterTurn(sampleEvents, 1);
    expect(res.keptEvents.length).toBe(6);
    expect(res.keptEvents.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("cuts after turn 2 correctly", () => {
    const res = cutAfterTurn(sampleEvents, 2);
    expect(res.keptEvents.length).toBe(10);
    expect(res.keptEvents.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("throws when cutting after incomplete turn", () => {
    expect(() => cutAfterTurn(sampleEvents, 3)).toThrow("Turn 3 has not completed");
  });
});
