export interface UpdateState {
  callTitles: Map<string, string>;
}

export function newUpdateState(): UpdateState {
  return { callTitles: new Map() };
}

export interface SessionLogEvent {
  type: string;
  data: Record<string, unknown>;
  surface?: {
    surfaceOp: "append" | "replace" | "clear";
  };
}

function textOf(content: any): string {
  if (typeof content === "string") return content;
  if (content?.type === "text") return String(content.text ?? "");
  if (Array.isArray(content)) return content.map(textOf).join("");
  if (content?.type === "content") return textOf(content.content);
  return "";
}

export function toSessionEvents(u: any, state: UpdateState): SessionLogEvent[] {
  const kind = u?.sessionUpdate;
  if (!kind) return [];

  if (kind === "agent_message_chunk") {
    const text = textOf(u.content);
    return text ? [{ type: "assistant/chunk", data: { chunk: { type: "text", text } } }] : [];
  }

  if (kind === "agent_thought_chunk") {
    const text = textOf(u.content);
    return text ? [{ type: "assistant/chunk", data: { chunk: { type: "reasoning", text } } }] : [];
  }

  if (kind === "tool_call") {
    const id = u.toolCallId;
    if (!id) return [];
    state.callTitles.set(id, u.title ?? u.kind ?? "tool");
    return [
      {
        type: "tool/call",
        data: { callId: id, name: u.title ?? u.kind ?? "tool", arguments: u.rawInput ?? {} },
      },
    ];
  }

  if (kind === "tool_call_update") {
    const id = u.toolCallId;
    if (!id) return [];
    if (u.status !== "completed" && u.status !== "failed") return [];
    const text = textOf(u.content);
    state.callTitles.delete(id);
    return [
      {
        type: "tool/result",
        data: { callId: id, ok: u.status === "completed", content: text },
        surface: { surfaceOp: "append" },
      },
    ];
  }

  return [];
}

export function danglingResults(state: UpdateState, reason: string): SessionLogEvent[] {
  const out: SessionLogEvent[] = [];
  for (const [id, title] of state.callTitles) {
    out.push({
      type: "tool/result",
      data: { callId: id, ok: false, content: `${title}: ${reason}` },
      surface: { surfaceOp: "append" },
    });
  }
  state.callTitles.clear();
  return out;
}
