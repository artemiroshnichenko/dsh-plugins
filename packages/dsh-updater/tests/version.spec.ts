import { describe, expect, it } from "vitest";
import { cleanVersion, compareVersions, isNewerVersion, parseVersion } from "../src/version.js";

describe("version helpers", () => {
  it("cleans version prefixes", () => {
    expect(cleanVersion("v1.2.3")).toBe("1.2.3");
    expect(cleanVersion("^0.1.5-rc.1")).toBe("0.1.5-rc.1");
    expect(cleanVersion("~0.1.2")).toBe("0.1.2");
  });

  it("parses semver versions", () => {
    const p1 = parseVersion("0.1.5-rc.1");
    expect(p1.major).toBe(0);
    expect(p1.minor).toBe(1);
    expect(p1.patch).toBe(5);
    expect(p1.prerelease).toEqual(["rc", "1"]);

    const p2 = parseVersion("2.0.0");
    expect(p2.major).toBe(2);
    expect(p2.prerelease).toEqual([]);
  });

  it("compares versions correctly", () => {
    expect(compareVersions("0.1.2-rc.1", "0.1.5-rc.1")).toBe(-1);
    expect(compareVersions("0.1.5-rc.1", "0.1.2-rc.1")).toBe(1);
    expect(compareVersions("0.1.2-rc.1", "0.1.2-rc.1")).toBe(0);
    expect(compareVersions("0.1.5-rc.1", "0.1.5-rc.2")).toBe(-1);
    expect(compareVersions("0.1.5-alpha.2", "0.1.5-rc.1")).toBe(-1);
    expect(compareVersions("0.1.5-rc.1", "0.1.5")).toBe(-1);
    expect(compareVersions("0.1.5", "0.1.5-rc.1")).toBe(1);
  });

  it("detects when a newer version is available", () => {
    expect(isNewerVersion("0.1.2-rc.1", "0.1.5-rc.1")).toBe(true);
    expect(isNewerVersion("0.1.5-rc.1", "0.1.5-rc.1")).toBe(false);
    expect(isNewerVersion("0.1.5-rc.2", "0.1.5-rc.1")).toBe(false);
    expect(isNewerVersion("", "0.1.5-rc.1")).toBe(false);
  });
});
