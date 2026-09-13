/**
 * Pure functions for inspecting session turns, extracting prompts, and computing fork boundaries.
 */

export interface EventEnvelope {
  type: string;
  seq: number;
  time?: number;
  data?: any;
}

/**
 * Locate the index of turn/start for the specified turn number.
 * Returns -1 if not found.
 */
export function findTurnStartIndex(events: readonly EventEnvelope[], turn: number): number {
  return events.findIndex((e) => e.type === "turn/start" && e.data?.turn === turn);
}

/**
 * Locate the index of turn/end for the specified turn number.
 * Returns -1 if not found.
 */
export function findTurnEndIndex(events: readonly EventEnvelope[], turn: number): number {
  return events.findIndex((e) => e.type === "turn/end" && e.data?.turn === turn);
}

/**
 * Extract plain user prompt text from the turn starting at turnStartIndex.
 */
export function extractUserPrompt(events: readonly EventEnvelope[], turnStartIndex: number): string {
  if (turnStartIndex < 0 || turnStartIndex >= events.length) return "";
  for (let i = turnStartIndex; i < events.length; i += 1) {
    const ev = events[i];
    if (ev.type === "turn/end") break;
    if (ev.type === "user/message") {
      const content = ev.data?.content;
      if (Array.isArray(content)) {
        let text = "";
        for (const block of content) {
          if (block && block.type === "text" && typeof block.text === "string") {
            text += block.text;
          }
        }
        if (text) return text;
      }
      if (typeof ev.data?.text === "string") return ev.data.text;
    }
  }
  return "";
}

/**
 * Cut event stream before the specified turn.
 * All events prior to turn/start of that turn are retained.
 */
export function cutBeforeTurn(
  events: readonly EventEnvelope[],
  turn: number
): { keptEvents: EventEnvelope[]; promptText: string } {
  const startIndex = findTurnStartIndex(events, turn);
  if (startIndex === -1) {
    throw new Error(`Turn ${turn} not found in session events`);
  }
  const promptText = extractUserPrompt(events, startIndex);
  const keptEvents = events.slice(0, startIndex) as EventEnvelope[];
  return { keptEvents, promptText };
}

/**
 * Cut event stream after the specified turn (inclusive of turn/end and any trailing events before the next turn/start).
 */
export function cutAfterTurn(
  events: readonly EventEnvelope[],
  turn: number
): { keptEvents: EventEnvelope[] } {
  const endIndex = findTurnEndIndex(events, turn);
  if (endIndex === -1) {
    throw new Error(`Turn ${turn} has not completed or was not found in session events`);
  }
  let cutIndex = endIndex + 1;
  while (cutIndex < events.length && events[cutIndex]?.type !== "turn/start") {
    cutIndex += 1;
  }
  const keptEvents = events.slice(0, cutIndex) as EventEnvelope[];
  return { keptEvents };
}
