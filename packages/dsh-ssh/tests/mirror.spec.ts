import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  toMirror,
  fromMirror,
  displayPath,
  pushRecent,
  safeHostName,
  hostRoot,
} from "../src/mirror.js";

const ROOT = "/tmp/dsh-ssh-root";

describe("mirror", () => {
  it("places remote directory shadow under host name", () => {
    expect(toMirror(ROOT, "staging", "/home/ubuntu/workspace")).toBe(
      join(ROOT, "staging", "home", "ubuntu", "workspace")
    );
  });

  it("handles remote root as host directory itself", () => {
    expect(toMirror(ROOT, "staging", "/")).toBe(join(ROOT, "staging"));
  });

  it("rejects relative remote paths", () => {
    expect(toMirror(ROOT, "staging", "~/projects")).toBeNull();
    expect(toMirror(ROOT, "staging", "projects")).toBeNull();
  });

  it("prevents traversing above mirror root", () => {
    const m = toMirror(ROOT, "staging", "/../../etc/passwd");
    expect(m).toBe(join(ROOT, "staging", "etc", "passwd"));
    expect(toMirror(ROOT, "../evil", "/x")).toBeNull();
    expect(safeHostName("..")).toBeNull();
    expect(hostRoot(ROOT, "a/b")).toBeNull();
  });

  it("extracts host and path from mirror location", () => {
    const local = toMirror(ROOT, "staging", "/home/ubuntu/workspace")!;
    expect(fromMirror(ROOT, local)).toEqual({ host: "staging", path: "/home/ubuntu/workspace" });
  });

  it("ignores paths not located in mirror directory", () => {
    expect(fromMirror(ROOT, "/Users/me/projects")).toBeNull();
    expect(fromMirror(ROOT, ROOT)).toBeNull();
    expect(fromMirror(ROOT, ROOT + "-other/staging/x")).toBeNull();
  });

  it("preserves paths containing spaces", () => {
    const local = toMirror(ROOT, "staging", "/home/ubuntu/my project")!;
    expect(fromMirror(ROOT, local)).toEqual({ host: "staging", path: "/home/ubuntu/my project" });
  });

  it("displays mirror path as remote path", () => {
    expect(displayPath(ROOT, toMirror(ROOT, "staging", "/srv/app")!)).toBe("/srv/app");
    expect(displayPath(ROOT, "/Users/me/notes")).toBe("/Users/me/notes");
  });

  it("updates recent folder list without duplicates up to limit", () => {
    expect(pushRecent(["/a", "/b"], "/b")).toEqual(["/b", "/a"]);
    expect(pushRecent(["/a", "/b", "/c"], "/d", 3)).toEqual(["/d", "/a", "/b"]);
    expect(pushRecent(null, "/a")).toEqual(["/a"]);
    expect(pushRecent(["/a"], "  ")).toEqual(["/a"]);
  });
});
