import { describe, it, expect, vi } from "vitest";
import { apply, platformFact, osFact, todayFact, harnessFact } from "../src/index.js";

describe("dsh-env", () => {
  it("computes platform fact with OS name and architecture", () => {
    const p = platformFact();
    expect(p).toMatch(/(macOS|Linux|Windows) \(\w+\)/);
  });

  it("computes os fact with kernel type and release", () => {
    const o = osFact();
    expect(o.length).toBeGreaterThan(0);
    expect(o).toContain(" ");
  });

  it("computes formatted date with ISO format and weekday", () => {
    const fixedDate = new Date("2026-09-09T12:00:00Z");
    const t = todayFact(fixedDate);
    expect(t).toContain("2026-09-09");
    expect(t).toContain("Wednesday");
  });

  it("handles harness version gracefully", () => {
    const h = harnessFact();
    expect(typeof h).toBe("string");
    expect(h.startsWith("dsh")).toBe(true);
  });

  it("registers system prompt variables with effects", () => {
    const registered: Record<string, () => string> = {};
    const mockCtx = {
      systemPrompt: {
        variable: (name: string, fn: () => string) => {
          registered[name] = fn;
          return () => { delete registered[name]; };
        },
      },
      effect: (fn: () => void) => fn(),
    };

    apply(mockCtx as any, {
      includeToday: true,
      includePlatform: true,
      includeOsVersion: true,
      includeHarnessVersion: true,
      customVariables: { team: "infra" },
    });

    expect(registered["today"]).toBeDefined();
    expect(registered["platform"]).toBeDefined();
    expect(registered["os_version"]).toBeDefined();
    expect(registered["harness_version"]).toBeDefined();
    expect(registered["team"]).toBeDefined();
    expect(registered["team"]()).toBe("infra");
  });
});
