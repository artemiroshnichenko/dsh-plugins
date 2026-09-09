import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import type { MirrorInfo } from "./types.js";

export const DEFAULT_MIRROR_ROOT = join(homedir(), ".dsh", "remote");

export function safeHostName(name: unknown): string | null {
  const n = String(name ?? "").trim();
  if (!n || n === "." || n === ".." || n.includes("/") || n.includes("\\")) return null;
  return n;
}

export function hostRoot(root: string, hostName: string): string | null {
  const n = safeHostName(hostName);
  return n ? join(resolve(root), n) : null;
}

export function toMirror(root: string, hostName: string, remotePath: string): string | null {
  const base = hostRoot(root, hostName);
  const p = String(remotePath ?? "").trim();
  if (!base || !p.startsWith("/")) return null;
  const parts = p.split("/").filter((s) => s && s !== "." && s !== "..");
  return parts.length ? join(base, ...parts) : base;
}

export function fromMirror(root: string, localPath: string): MirrorInfo | null {
  const base = resolve(root);
  const p = resolve(String(localPath ?? ""));
  if (p === base) return null;
  if (!p.startsWith(base + sep)) return null;
  const rest = p.slice(base.length + 1).split(sep).filter(Boolean);
  if (!rest.length) return null;
  const [host, ...tail] = rest;
  return { host, path: "/" + tail.join("/") };
}

export function displayPath(root: string, localPath: string): string {
  const m = fromMirror(root, localPath);
  return m ? m.path : String(localPath ?? "");
}

export function pushRecent(list: unknown, path: unknown, max = 5): string[] {
  const p = String(path ?? "").trim();
  if (!p) return Array.isArray(list) ? [...list] : [];
  const rest = (Array.isArray(list) ? list : []).filter((x) => typeof x === "string" && x !== p);
  return [p, ...rest].slice(0, max);
}
