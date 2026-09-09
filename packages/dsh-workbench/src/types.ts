export interface WorkbenchConfig {
  /** Maximum file size in bytes readable in browser editor. Defaults to 2MB (2097152). */
  maxReadBytes?: number;
  /** Maximum number of entries returned in a directory listing. Defaults to 2000. */
  maxEntries?: number;
  /** Timeout in milliseconds for git queries. Defaults to 15000. */
  gitTimeoutMs?: number;
  /** Timeout in milliseconds for terminal command execution. Defaults to 120000. */
  shellTimeoutMs?: number;
  /** Directory names skipped during directory listings. */
  skipDirs?: string[];
  /** Maximum number of output characters returned from terminal execution. Defaults to 200000. */
  maxOutputChars?: number;
}

export interface DirectoryEntry {
  name: string;
  rel: string;
  dir: boolean;
  size: number;
  mtime: number;
  editable: boolean;
  status: string;
}

export interface ListResult {
  root: string;
  rel: string;
  entries: DirectoryEntry[];
  truncated: boolean;
  git: boolean;
}

export interface ReadResult {
  rel: string;
  path: string;
  text: string;
  version: string;
  size: number;
  language: string;
}

export interface SaveResult {
  rel: string;
  version: string;
  size: number;
}

export interface GitFileChange {
  rel: string;
  status: string;
  code: string;
  staged: boolean;
  editable: boolean;
}

export interface ChangesResult {
  root: string;
  git: boolean;
  branch: string;
  files: GitFileChange[];
}

export interface DiffResult {
  rel: string;
  text?: string;
  truncated?: boolean;
}

export interface RunResult {
  cwd: string;
  root: string;
  command: string;
  code: number;
  timedOut: boolean;
  durationMs: number;
  text: string;
  truncated: boolean;
}

export interface ResetShellResult {
  cwd: string;
}
