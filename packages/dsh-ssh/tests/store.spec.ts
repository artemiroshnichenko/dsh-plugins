import { mkdtemp, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { loadHosts, saveHosts, mergeHosts, validateHost } from "../src/store.js";
import { normalizeHost } from "../src/hosts.js";

const tmp = async () => join(await mkdtemp(join(tmpdir(), "dsh-ssh-test-")), "hosts.json");

describe("store", () => {
  it("returns empty array for missing or corrupt files", async () => {
    expect(await loadHosts(await tmp())).toEqual([]);
    const p = await tmp();
    await saveHosts([normalizeHost({ name: "x" })!], p);
    await writeFile(p, "{invalid-json");
    expect(await loadHosts(p)).toEqual([]);
  });

  it("saves and reads host entries with all fields", async () => {
    const p = await tmp();
    const original = normalizeHost({
      name: "server",
      ssh: "ubuntu@1.2.3.4",
      port: 2222,
      identityFile: "~/.ssh/id_ed25519",
      cwd: "/srv/app",
    })!;
    await saveHosts([original], p);
    const [h] = await loadHosts(p);
    expect(h.name).toBe("server");
    expect(h.ssh).toBe("ubuntu@1.2.3.4");
    expect(h.port).toBe(2222);
    expect(h.identityFile).toBe("~/.ssh/id_ed25519");
    expect(h.cwd).toBe("/srv/app");
  });

  it("writes store file with mode 0o600", async () => {
    const p = await tmp();
    await saveHosts([normalizeHost({ name: "a", cwd: "/x" })!], p);
    const s = await stat(p);
    expect(s.mode & 0o777).toBe(0o600);
  });

  it("prioritizes config hosts over store hosts on name collisions", () => {
    const cfg = [normalizeHost({ name: "staging", cwd: "/from/config", source: "config" })!];
    const usr = [
      normalizeHost({ name: "staging", cwd: "/from/user" })!,
      normalizeHost({ name: "srv", cwd: "/s" })!,
    ];
    const m = mergeHosts(cfg, usr);
    expect(m.map((h) => h.name)).toEqual(["staging", "srv"]);
    expect(m[0].cwd).toBe("/from/config");
  });

  it("validates host entries and returns descriptive errors", () => {
    expect(validateHost({})).toMatch(/name/i);
    expect(validateHost({ name: "ok", ssh: "a b", cwd: "/x" })).toMatch(/spaces/i);
    expect(validateHost({ name: "ok", cwd: "" })).toMatch(/directory/i);
    expect(validateHost({ name: "ok", cwd: "relative/path" })).toMatch(/absolute/i);
    expect(validateHost({ name: "ok", cwd: "/x", port: "not a number" })).toMatch(/port/i);
    expect(validateHost({ name: "bad/name", cwd: "/x" })).toMatch(/name/i);
  });

  it("accepts valid host entries", () => {
    expect(validateHost({ name: "staging", cwd: "/home/ubuntu/w" })).toBeNull();
    expect(validateHost({ name: "staging", cwd: "~/work" })).toBeNull();
    expect(validateHost({ name: "staging", ssh: "root@10.0.0.1", port: 2222, cwd: "/srv" })).toBeNull();
    expect(validateHost({ name: "staging", cwd: "/srv", port: "" })).toBeNull();
  });

  it("preserves recent folders from store for config hosts", () => {
    const config = [normalizeHost({ name: "staging", cwd: "/srv", source: "config" })!];
    const store = [normalizeHost({ name: "staging", cwd: "/other", recent: ["/srv/app"] })!];
    const [h] = mergeHosts(config, store);
    expect(h.cwd).toBe("/srv");
    expect(h.recent).toEqual(["/srv/app"]);
  });
});
