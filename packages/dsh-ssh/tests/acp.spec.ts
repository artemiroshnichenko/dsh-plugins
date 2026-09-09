import { describe, it, expect } from "vitest";
import { LineDecoder, classify, isStartupRace, AcpError, NO_ADAPTER_RE } from "../src/acp.js";

describe("acp", () => {
  it("decodes chunks into messages", () => {
    const d = new LineDecoder();
    expect(d.push('{"a":')).toEqual([]);
    expect(d.push('1}\n')).toEqual([{ a: 1 }]);
    expect(d.pending).toBe(0);
  });

  it("handles multiple messages in one chunk", () => {
    const d = new LineDecoder();
    expect(d.push('{"a":1}\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("skips junk and empty lines without losing subsequent messages", () => {
    const d = new LineDecoder();
    expect(d.push('ssh noise\n\n{"ok":true}\n')).toEqual([{ ok: true }]);
  });

  it("buffers partial trailing message without newline", () => {
    const d = new LineDecoder();
    expect(d.push('{"a":1}\n{"partial":')).toEqual([{ a: 1 }]);
    expect(d.pending).toBeGreaterThan(0);
    expect(d.push('2}\n')).toEqual([{ partial: 2 }]);
  });

  it("classifies json-rpc messages correctly", () => {
    expect(classify({ id: 1, method: "session/request_permission" }).kind).toBe("request");
    expect(classify({ id: 1, result: {} }).kind).toBe("response");
    expect(classify({ id: 1, error: { code: -1 } }).kind).toBe("response");
    expect(classify({ method: "session/update", params: {} }).kind).toBe("notification");
    expect(classify(null).kind).toBe("junk");
    expect(classify({}).kind).toBe("junk");
  });

  it("handles id=0 as a valid response id", () => {
    expect(classify({ id: 0, result: {} }).kind).toBe("response");
  });

  it("detects startup adapter race conditions", () => {
    expect(
      isStartupRace(
        new AcpError({ message: 'Internal error | no adapter registered for provider "omniroute"' }, "session/new")
      )
    ).toBe(true);
    expect(isStartupRace(new AcpError({ message: "workspace not found" }, "session/new"))).toBe(false);
    expect(isStartupRace(new Error("no adapter registered for provider x"))).toBe(false);
    expect(NO_ADAPTER_RE.test("No Adapter Registered For Provider foo")).toBe(true);
  });
});
