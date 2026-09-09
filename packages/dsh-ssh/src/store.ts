import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { normalizeHost } from "./hosts.js";
import type { NormalizedHost } from "./types.js";

export const DEFAULT_STORE = join(homedir(), ".dsh", "ssh-hosts.json");

export async function loadHosts(path = DEFAULT_STORE): Promise<NormalizedHost[]> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    const list = Array.isArray(raw?.hosts) ? raw.hosts : [];
    return list.map(normalizeHost).filter((h: any): h is NormalizedHost => h !== null);
  } catch {
    return [];
  }
}

export async function saveHosts(hosts: NormalizedHost[], path = DEFAULT_STORE): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify({ version: 1, hosts }, null, 2) + "\n", { mode: 0o600 });
  await rename(tmp, path);
}

export function mergeHosts(fromConfig: NormalizedHost[], fromStore: NormalizedHost[]): NormalizedHost[] {
  const byName = new Map<string, NormalizedHost>(fromStore.map((h) => [h.name, h]));
  const out = fromConfig.map((h) => {
    const kept = byName.get(h.name);
    return kept && !(h.recent ?? []).length ? { ...h, recent: kept.recent ?? [] } : h;
  });
  const taken = new Set<string>(fromConfig.map((h) => h.name));
  for (const h of fromStore) {
    if (!taken.has(h.name)) out.push(h);
  }
  return out;
}

export function validateHost(entry: any): string | null {
  const h = normalizeHost(entry);
  if (!h) return "connection name is required";
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/.test(h.name)) {
    return "name must consist of letters, numbers, spaces, dots, hyphens, and underscores";
  }
  if (!h.ssh) return "host address required (user@host or ~/.ssh/config name)";
  if (/\s/.test(h.ssh)) return "host address cannot contain spaces";
  if (
    entry.port !== undefined &&
    entry.port !== null &&
    String(entry.port).trim() !== "" &&
    h.port === null
  ) {
    return "port must be an integer between 1 and 65535";
  }
  if (!h.cwd) return "remote working directory required";
  if (!h.cwd.startsWith("/") && !h.cwd.startsWith("~")) {
    return "working directory must be absolute or start with ~";
  }
  return null;
}
