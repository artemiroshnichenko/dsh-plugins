import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { DirEntry, DirListing, NormalizedHost } from "./types.js";

/** Extract Host names from ~/.ssh/config excluding wildcard patterns. */
export function parseSshConfig(text: string): string[] {
  const names = new Set<string>();
  for (const line of String(text).split("\n")) {
    const m = /^\s*Host\s+(.+?)\s*$/i.exec(line);
    if (!m) continue;
    for (const n of m[1].split(/\s+/)) {
      if (n && !/[*?!]/.test(n)) names.add(n);
    }
  }
  return [...names].sort();
}

export async function sshConfigHosts(path = join(homedir(), ".ssh", "config")): Promise<string[]> {
  try {
    return parseSshConfig(await readFile(path, "utf8"));
  } catch {
    return [];
  }
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export const DEFAULT_REMOTE_PATH = "$HOME/.agents/bin:$HOME/.nvm/current/bin:$PATH";
export const PID_MARK = "DSH_SSH_PID=";

export function normalizeHost(entry: unknown): NormalizedHost | null {
  let e: any = entry;
  if (typeof e === "string" && e.trim()) e = { name: e.trim() };
  if (!e || typeof e !== "object") return null;
  const name = str(e.name);
  if (!name) return null;
  const port = Number(e.port);
  return {
    name,
    ssh: str(e.ssh) ?? name,
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : null,
    identityFile: str(e.identityFile),
    cwd: str(e.cwd),
    remotePath: str(e.remotePath) ?? DEFAULT_REMOTE_PATH,
    profile: str(e.profile) ?? "acp",
    recent: Array.isArray(e.recent) ? e.recent.filter((x: unknown) => typeof x === "string").slice(0, 5) : [],
    source: e.source === "config" ? "config" : "user",
  };
}

export function remoteCommand(host: NormalizedHost): string {
  return `export PATH=${host.remotePath}; echo "${PID_MARK}$$" >&2; exec dsh --profile ${host.profile}`;
}

export function sshPlainArgs(host: NormalizedHost, script: string, { connectTimeout = 10 } = {}): string[] {
  return ["-o", `ConnectTimeout=${connectTimeout}`, "-o", "BatchMode=yes", ...connectionFlags(host), host.ssh, script];
}

export function reapCommand(host: NormalizedHost): string {
  const pat = `bin.js --profile ${host.profile}`;
  return [
    `pkill -f ${JSON.stringify(pat)} 2>/dev/null || true`,
    "for i in 1 2 3 4 5; do",
    `  pgrep -f ${JSON.stringify(pat)} >/dev/null || exit 0`,
    "  sleep 1",
    "done",
    `pkill -9 -f ${JSON.stringify(pat)} 2>/dev/null || true`,
  ].join("\n");
}

export function connectionFlags(host: NormalizedHost): string[] {
  const flags: string[] = [];
  if (host.port) flags.push("-p", String(host.port));
  if (host.identityFile) flags.push("-i", host.identityFile, "-o", "IdentitiesOnly=yes");
  return flags;
}

export function sshArgs(host: NormalizedHost, { connectTimeout = 10 } = {}): string[] {
  return [
    "-o", `ConnectTimeout=${connectTimeout}`,
    "-o", "BatchMode=yes",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=4",
    ...connectionFlags(host),
    host.ssh,
    remoteCommand(host),
  ];
}

export function killRemoteCommand(pid: number | string): string {
  const p = Number(pid);
  if (!Number.isInteger(p) || p <= 1) return "true";
  return `kill -TERM ${p} 2>/dev/null || true; sleep 1; kill -KILL ${p} 2>/dev/null || true`;
}

export function quoteForRemote(p: string): string {
  const s = String(p ?? "").trim();
  if (!s) return "$HOME";
  if (s === "~") return "$HOME";
  if (s.startsWith("~/")) return `$HOME/'${s.slice(2).replace(/'/g, "'\\''")}'`;
  return `'${s.replace(/'/g, "'\\''")}'`;
}

export const quoteRemotePath = quoteForRemote;

export function listDirCommand(path?: string, { limit = 500 } = {}): string {
  const q = quoteRemotePath(path ?? "~");
  return [
    `d=${q}`,
    `[ -e "$d" ] || exit 2`,
    `[ -d "$d" ] || exit 4`,
    `cd "$d" 2>/dev/null || exit 3`,
    `pwd`,
    `ls -1Ap 2>/dev/null | head -${limit}`,
  ].join("; ");
}

export function parseDirListing(stdout: string): DirListing {
  const lines = String(stdout ?? "").split("\n");
  const resolved = (lines.shift() ?? "").trim();
  const entries: DirEntry[] = [];
  for (const raw of lines) {
    const name = raw.trimEnd();
    if (!name) continue;
    const isDirectory = name.endsWith("/");
    entries.push({ name: isDirectory ? name.slice(0, -1) : name, isDirectory });
  }
  entries.sort((a, b) =>
    a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1
  );
  return { resolved, entries };
}

export function parentOf(p?: string | null): string | null {
  const s = String(p ?? "").replace(/\/+$/, "");
  if (!s || s === "/" || s === "~") return null;
  const i = s.lastIndexOf("/");
  if (i < 0) return null;
  return i === 0 ? "/" : s.slice(0, i);
}
