import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import {
  parseSshConfig,
  normalizeHost,
  remoteCommand,
  sshArgs,
  sshPlainArgs,
  reapCommand,
  quoteRemotePath,
  listDirCommand,
  parseDirListing,
  parentOf,
  DEFAULT_REMOTE_PATH,
  PID_MARK,
} from "../src/hosts.js";

describe("hosts", () => {
  it("parses ssh config excluding wildcards and Match directives", () => {
    const names = parseSshConfig(`
Host staging production
  User ubuntu
Host *
  ServerAliveInterval 60
Host bastion-?
  Port 22
  host lowercase-ok
Match host foo
`);
    expect(names).toEqual(["lowercase-ok", "production", "staging"]);
  });

  it("handles empty or invalid config without throwing", () => {
    expect(parseSshConfig("")).toEqual([]);
    expect(parseSshConfig("not a config at all")).toEqual([]);
  });

  it("normalizes host inputs", () => {
    expect(normalizeHost("staging")).toEqual({
      name: "staging",
      ssh: "staging",
      port: null,
      identityFile: null,
      cwd: null,
      remotePath: DEFAULT_REMOTE_PATH,
      profile: "acp",
      recent: [],
      source: "user",
    });
    expect(normalizeHost({ ssh: "x" })).toBeNull();
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeHost({ name: "  " })).toBeNull();

    const h = normalizeHost({ name: "srv", ssh: "user@1.2.3.4", cwd: "/srv/app", profile: "acp2" });
    expect(h?.ssh).toBe("user@1.2.3.4");
    expect(h?.cwd).toBe("/srv/app");
    expect(h?.profile).toBe("acp2");
  });

  it("builds remoteCommand with PATH and exec for signals", () => {
    const cmd = remoteCommand(normalizeHost("staging")!);
    expect(cmd).toContain("exec dsh --profile acp");
    expect(cmd.indexOf(".nvm")).toBeLessThan(cmd.indexOf("$PATH"));
  });

  it("builds sshArgs with keepalive and batch mode", () => {
    const a = sshArgs(normalizeHost("staging")!);
    expect(a).toContain("BatchMode=yes");
    expect(a).toContain("ServerAliveInterval=15");
    expect(a[a.length - 2]).toBe("staging");
    expect(a[a.length - 1].startsWith("export PATH=")).toBe(true);
  });

  it("emits PID mark to stderr", () => {
    const cmd = remoteCommand(normalizeHost("staging")!);
    expect(cmd).toContain(">&2");
    expect(cmd.indexOf(PID_MARK)).toBeLessThan(cmd.indexOf("exec dsh"));
  });

  it("builds reapCommand targeted only at profile", () => {
    const cmd = reapCommand(normalizeHost("staging")!);
    expect(cmd).toContain("--profile acp");
    expect(cmd).toContain("pgrep");
    expect(cmd).toContain("pkill -9");
    expect(cmd.indexOf("pkill -f")).toBeLessThan(cmd.indexOf("pkill -9"));
    expect(cmd.trimEnd().endsWith("true")).toBe(true);
  });

  it("reapCommand respects custom host profile", () => {
    expect(reapCommand(normalizeHost({ name: "srv", profile: "acp2" })!)).toContain("--profile acp2");
  });

  it("builds sshPlainArgs for batch utilities", () => {
    const a = sshPlainArgs(normalizeHost("staging")!, "true");
    expect(a).toContain("BatchMode=yes");
    expect(a[a.length - 1]).toBe("true");
    expect(a[a.length - 2]).toBe("staging");
  });

  it("includes port and identity file in sshArgs", () => {
    const h = normalizeHost({
      name: "srv",
      ssh: "root@1.2.3.4",
      port: 2222,
      identityFile: "~/.ssh/id_ed25519",
      cwd: "/srv",
    })!;
    const a = sshArgs(h);
    expect(a[a.indexOf("-p") + 1]).toBe("2222");
    expect(a[a.indexOf("-i") + 1]).toBe("~/.ssh/id_ed25519");
    expect(a).toContain("IdentitiesOnly=yes");
    expect(sshPlainArgs(h, "true")).toContain("2222");
  });

  it("omits -p and -i when not specified", () => {
    const a = sshArgs(normalizeHost("staging")!);
    expect(a).not.toContain("-p");
    expect(a).not.toContain("-i");
  });

  it("rejects invalid ports during normalization", () => {
    expect(normalizeHost({ name: "a", port: 0 })?.port).toBeNull();
    expect(normalizeHost({ name: "a", port: 99999 })?.port).toBeNull();
    expect(normalizeHost({ name: "a", port: "2222" })?.port).toBe(2222);
  });

  it("quotes remote paths correctly", () => {
    expect(quoteRemotePath("~")).toBe("$HOME");
    expect(quoteRemotePath("~/work")).toBe("$HOME/'work'");
    expect(quoteRemotePath("/srv/app")).toBe("'/srv/app'");
    expect(quoteRemotePath("")).toBe("$HOME");
  });

  it("escapes malicious paths safely via shell execution", () => {
    const evil = ["/tmp'; rm -rf /; echo '", "/a b/c", "/x$(whoami)y", "/back\\slash", "/dollar$HOME"];
    for (const p of evil) {
      const out = execFileSync("/bin/sh", ["-c", `d=${quoteRemotePath(p)}; printf %s "$d"`], {
        encoding: "utf8",
      });
      expect(out).toBe(p);
    }
  });

  it("expands tilde via shell while preserving tail literal", () => {
    const home = execFileSync("/bin/sh", ["-c", 'printf %s "$HOME"'], { encoding: "utf8" });
    const out = execFileSync("/bin/sh", ["-c", `d=${quoteRemotePath("~/my dir")}; printf %s "$d"`], {
      encoding: "utf8",
    });
    expect(out).toBe(`${home}/my dir`);
  });

  it("formats listDirCommand with correct exit codes", () => {
    const c = listDirCommand("~/work");
    expect(c).toContain("exit 2");
    expect(c).toContain("exit 3");
    expect(c).toContain("exit 4");
    expect(c).toContain("pwd");
    expect(c).toContain("ls -1Ap");
  });

  it("parses directory listings with directories sorted before files", () => {
    const r = parseDirListing("/home/ubuntu\nprojects/\n.config/\nnotes.md\nzz/\n");
    expect(r.resolved).toBe("/home/ubuntu");
    expect(r.entries.map((e) => e.name)).toEqual([".config", "projects", "zz", "notes.md"]);
    expect(r.entries.map((e) => e.isDirectory)).toEqual([true, true, true, false]);
  });

  it("handles empty directory listings gracefully", () => {
    expect(parseDirListing("/x\n").entries).toEqual([]);
    expect(parseDirListing("").entries).toEqual([]);
  });

  it("computes parent directories correctly", () => {
    expect(parentOf("/home/ubuntu/work")).toBe("/home/ubuntu");
    expect(parentOf("/home")).toBe("/");
    expect(parentOf("/")).toBeNull();
    expect(parentOf("~")).toBeNull();
    expect(parentOf("/srv/app/")).toBe("/srv");
  });

  it("normalizes recent folders to at most 5 strings", () => {
    const h = normalizeHost({ name: "a", recent: ["/1", "/2", 42, null, "/3", "/4", "/5", "/6"] });
    expect(h?.recent).toEqual(["/1", "/2", "/3", "/4", "/5"]);
    expect(normalizeHost({ name: "a", recent: "not an array" })?.recent).toEqual([]);
  });
});
