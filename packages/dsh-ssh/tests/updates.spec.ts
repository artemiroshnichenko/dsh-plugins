import { describe, it, expect } from "vitest";
import { toSessionEvents, danglingResults, newUpdateState } from "../src/updates.js";

const S = () => newUpdateState();

describe("updates", () => {
  it("translates agent_message_chunk to assistant/chunk text event", () => {
    const e = toSessionEvents(
      { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello" } },
      S()
    );
    expect(e).toEqual([{ type: "assistant/chunk", data: { chunk: { type: "text", text: "hello" } } }]);
  });

  it("translates agent_thought_chunk to reasoning chunk", () => {
    const e = toSessionEvents(
      { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "thinking" } },
      S()
    );
    expect(e[0].data.chunk).toEqual({ type: "reasoning", text: "thinking" });
  });

  it("ignores empty text chunks", () => {
    expect(
      toSessionEvents({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "" } }, S())
    ).toEqual([]);
  });

  it("records tool calls with name and arguments", () => {
    const st = S();
    const e = toSessionEvents(
      { sessionUpdate: "tool_call", toolCallId: "t1", title: "bash", rawInput: { command: "ls" } },
      st
    );
    expect(e).toEqual([
      { type: "tool/call", data: { callId: "t1", name: "bash", arguments: { command: "ls" } } },
    ]);
    expect(st.callTitles.get("t1")).toBe("bash");
  });

  it("ignores intermediate progress updates", () => {
    const st = S();
    toSessionEvents({ sessionUpdate: "tool_call", toolCallId: "t1", title: "bash" }, st);
    expect(
      toSessionEvents({ sessionUpdate: "tool_call_update", toolCallId: "t1", status: "in_progress" }, st)
    ).toEqual([]);
    expect(st.callTitles.size).toBe(1);
  });

  it("creates tool/result with surfaceOp on tool completion", () => {
    const st = S();
    toSessionEvents({ sessionUpdate: "tool_call", toolCallId: "t1", title: "bash" }, st);
    const e = toSessionEvents(
      {
        sessionUpdate: "tool_call_update",
        toolCallId: "t1",
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: "Linux vm" } }],
      },
      st
    );
    expect(e[0].type).toBe("tool/result");
    expect(e[0].data.ok).toBe(true);
    expect(e[0].data.content).toBe("Linux vm");
    expect(e[0].surface).toEqual({ surfaceOp: "append" });
    expect(st.callTitles.size).toBe(0);
  });

  it("marks failed tool executions with ok: false", () => {
    const st = S();
    toSessionEvents({ sessionUpdate: "tool_call", toolCallId: "t1", title: "bash" }, st);
    const e = toSessionEvents(
      { sessionUpdate: "tool_call_update", toolCallId: "t1", status: "failed", content: "boom" },
      st
    );
    expect(e[0].data.ok).toBe(false);
  });

  it("closes dangling tool calls with error on disconnection", () => {
    const st = S();
    toSessionEvents({ sessionUpdate: "tool_call", toolCallId: "a", title: "bash" }, st);
    toSessionEvents({ sessionUpdate: "tool_call", toolCallId: "b", title: "read" }, st);
    const e = danglingResults(st, "connection lost");
    expect(e.length).toBe(2);
    expect(e.every((x) => x.type === "tool/result" && x.data.ok === false)).toBe(true);
    expect(e[0].data.content).toContain("connection lost");
    expect(st.callTitles.size).toBe(0);
  });

  it("ignores unknown or usage events", () => {
    expect(toSessionEvents({ sessionUpdate: "usage_update", used: 1 }, S())).toEqual([]);
    expect(toSessionEvents({ sessionUpdate: "something_unknown" }, S())).toEqual([]);
    expect(toSessionEvents({}, S())).toEqual([]);
    expect(toSessionEvents(null, S())).toEqual([]);
  });

  it("skips tool calls without an id", () => {
    const st = S();
    expect(toSessionEvents({ sessionUpdate: "tool_call", title: "bash" }, st)).toEqual([]);
    expect(st.callTitles.size).toBe(0);
  });
});
