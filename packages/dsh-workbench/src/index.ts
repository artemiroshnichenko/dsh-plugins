import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import Schema from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
import {
  DEFAULT_SKIP_DIRS,
  confine,
  languageOf,
  looksTextual,
  resolveRoot,
  versionOf,
} from "./paths.js";
import type {
  ChangesResult,
  DiffResult,
  DirectoryEntry,
  GitFileChange,
  ListResult,
  ReadResult,
  ResetShellResult,
  RunResult,
  SaveResult,
  WorkbenchConfig,
} from "./types.js";

export * from "./types.js";
export * from "./paths.js";

export const NAMESPACE = "dshWorkbench";
export const name = "dsh-workbench";

export const Config: Schema<WorkbenchConfig> = Schema.object({
  maxReadBytes: Schema.number().default(2 * 1024 * 1024).description("Maximum file size readable in editor"),
  maxEntries: Schema.number().default(2000).description("Maximum directory entries returned"),
  gitTimeoutMs: Schema.number().default(15000).description("Timeout for git queries in milliseconds"),
  shellTimeoutMs: Schema.number().default(120000).description("Timeout for shell commands in milliseconds"),
  skipDirs: Schema.array(Schema.string()).default([...DEFAULT_SKIP_DIRS]).description("Directory names to skip walking"),
  maxOutputChars: Schema.number().default(200000).description("Maximum output characters returned from commands"),
});

const CWD_MARK = "__dsh_workbench_cwd__";

interface ExecOutput {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  failed: string;
}

function exec(file: string, args: string[], cwd: string, timeoutMs: number): Promise<ExecOutput> {
  return new Promise((resolveResult) => {
    execFile(
      file,
      args,
      { cwd, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, killSignal: "SIGKILL" },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === "number" ? error.code : 1;
        resolveResult({
          code,
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          timedOut: error !== null && (error as any).killed === true,
          failed: error !== null && typeof error.code !== "number" ? String(error.message) : "",
        });
      }
    );
  });
}

function cap(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

function statusWord(code: string): string {
  if (code === "??") return "untracked";
  if (code.includes("D")) return "deleted";
  if (code.includes("A")) return "added";
  if (code.includes("R")) return "renamed";
  if (code.includes("U") || code === "AA" || code === "DD") return "conflict";
  return "modified";
}

export default class DshWorkbench extends TypertRemoteService {
  static inject = ["sessions"];

  private shellCwd = new Map<string, string>();
  private cfg: Required<WorkbenchConfig>;
  private skipSet: Set<string>;

  constructor(ctx: Context, config: WorkbenchConfig = {}) {
    super(ctx, NAMESPACE);

    this.cfg = {
      maxReadBytes: config.maxReadBytes ?? 2 * 1024 * 1024,
      maxEntries: config.maxEntries ?? 2000,
      gitTimeoutMs: config.gitTimeoutMs ?? 15000,
      shellTimeoutMs: config.shellTimeoutMs ?? 120000,
      skipDirs: config.skipDirs ?? [...DEFAULT_SKIP_DIRS],
      maxOutputChars: config.maxOutputChars ?? 200000,
    };
    this.skipSet = new Set(this.cfg.skipDirs);
  }

  async rootFor(sessionId?: string, root?: string): Promise<string> {
    if (typeof sessionId === "string" && sessionId !== "") {
      const session = (this.ctx as any).sessions?.get?.(sessionId);
      const cwd = session?.header?.cwd;
      if (typeof cwd === "string" && cwd !== "") return resolveRoot(cwd);
    }
    return resolveRoot(root);
  }

  async gitStatusMap(realRoot: string): Promise<Map<string, { code: string; status: string; staged: boolean }> | null> {
    const res = await exec(
      "git",
      ["status", "--porcelain=v1", "-z", "--untracked-files=normal"],
      realRoot,
      this.cfg.gitTimeoutMs
    );
    if (res.code !== 0) return null;
    const map = new Map<string, { code: string; status: string; staged: boolean }>();
    const parts = res.stdout.split("\0");
    for (let i = 0; i < parts.length; i += 1) {
      const item = parts[i];
      if (item.length < 4) continue;
      const code = item.slice(0, 2);
      const filePath = item.slice(3);
      if (code.startsWith("R") || code.startsWith("C")) {
        i += 1;
      }
      map.set(filePath, { code, status: statusWord(code), staged: code[0] !== " " && code[0] !== "?" });
    }
    return map;
  }

  @Remote("list")
  async list(sessionId?: string, root?: string, rel?: string): Promise<ListResult> {
    const realRoot = await this.rootFor(sessionId, root);
    const at = await confine(realRoot, rel);
    const names = await readdir(at.path, { withFileTypes: true });
    const status = await this.gitStatusMap(realRoot);
    const entries: DirectoryEntry[] = [];

    for (const dirent of names) {
      if (entries.length >= this.cfg.maxEntries) break;
      const isDir = dirent.isDirectory();
      if (isDir && this.skipSet.has(dirent.name)) continue;
      const childRel = at.rel === "" ? dirent.name : `${at.rel}/${dirent.name}`;
      let size = 0;
      let mtime = 0;
      try {
        const info = await stat(join(at.path, dirent.name));
        size = info.size;
        mtime = info.mtimeMs;
      } catch {
        // preserve entry row for broken symlink
      }
      const st = status?.get(childRel);
      entries.push({
        name: dirent.name,
        rel: childRel,
        dir: isDir,
        size,
        mtime,
        editable: !isDir && looksTextual(dirent.name) && size <= this.cfg.maxReadBytes,
        status: st?.status ?? "",
      });
    }

    entries.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
    return {
      root: realRoot,
      rel: at.rel,
      entries,
      truncated: entries.length >= this.cfg.maxEntries,
      git: status !== null,
    };
  }

  @Remote("read")
  async read(sessionId?: string, root?: string, rel?: string): Promise<ReadResult> {
    const realRoot = await this.rootFor(sessionId, root);
    const at = await confine(realRoot, rel);
    if (!at.exists) throw new Error(`workbench: no such file: ${rel}`);
    const info = await stat(at.path);
    if (info.isDirectory()) throw new Error(`workbench: path is a directory: ${rel}`);
    if (info.size > this.cfg.maxReadBytes) {
      throw new Error(`workbench: file exceeds limit (${info.size} bytes, limit ${this.cfg.maxReadBytes})`);
    }
    const buffer = await readFile(at.path);
    if (buffer.includes(0)) throw new Error(`workbench: binary file cannot be opened in editor: ${rel}`);
    return {
      rel: at.rel,
      path: at.path,
      text: buffer.toString("utf8"),
      version: versionOf(info),
      size: info.size,
      language: languageOf(at.rel.split("/").pop() ?? ""),
    };
  }

  @Remote("save")
  async save(
    sessionId?: string,
    root?: string,
    rel?: string,
    text?: string,
    version?: string
  ): Promise<SaveResult> {
    if (typeof text !== "string") throw new Error("workbench: save requires file text");
    const realRoot = await this.rootFor(sessionId, root);
    const at = await confine(realRoot, rel);
    if (at.exists) {
      const info = await stat(at.path);
      if (info.isDirectory()) throw new Error(`workbench: cannot overwrite directory: ${rel}`);
      const current = versionOf(info);
      if (typeof version === "string" && version !== "" && version !== current) {
        throw new Error("workbench: file has been modified on disk; please reload");
      }
    }
    if (!at.exists) await mkdir(dirname(at.path), { recursive: true });
    await writeFile(at.path, text, "utf8");
    const info = await stat(at.path);
    return { rel: at.rel, version: versionOf(info), size: info.size };
  }

  @Remote("changes")
  async changes(sessionId?: string, root?: string): Promise<ChangesResult> {
    const realRoot = await this.rootFor(sessionId, root);
    const head = await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], realRoot, this.cfg.gitTimeoutMs);
    if (head.code !== 0) return { root: realRoot, git: false, branch: "", files: [] };
    const status = await this.gitStatusMap(realRoot);
    const files: GitFileChange[] = [...(status ?? new Map())].map(([rel, st]) => ({
      rel,
      status: st.status,
      code: st.code,
      staged: st.staged,
      editable: looksTextual(rel.split("/").pop() ?? ""),
    }));
    files.sort((a, b) => a.rel.localeCompare(b.rel));
    return { root: realRoot, git: true, branch: head.stdout.trim(), files };
  }

  @Remote("diff")
  async diff(sessionId?: string, root?: string, rel?: string): Promise<DiffResult> {
    const realRoot = await this.rootFor(sessionId, root);
    const args = ["--no-pager", "diff", "--no-color", "HEAD", "--"];
    const target = typeof rel === "string" && rel !== "" ? (await confine(realRoot, rel)).rel : "";
    const res = await exec("git", target === "" ? args.slice(0, -1) : [...args, target], realRoot, this.cfg.gitTimeoutMs);
    if (res.code !== 0 && res.stdout === "") {
      if (target !== "") {
        const added = await exec(
          "git",
          ["--no-pager", "diff", "--no-color", "--no-index", "/dev/null", target],
          realRoot,
          this.cfg.gitTimeoutMs
        );
        if (added.stdout !== "") return { rel: target, ...cap(added.stdout, this.cfg.maxOutputChars) };
      }
      return { rel: target, text: res.stderr.trim() === "" ? "" : res.stderr, truncated: false };
    }
    return { rel: target, ...cap(res.stdout, this.cfg.maxOutputChars) };
  }

  @Remote("run")
  async run(sessionId?: string, root?: string, command?: string): Promise<RunResult> {
    if (typeof command !== "string" || command.trim() === "") {
      throw new Error("workbench: no command provided");
    }
    const realRoot = await this.rootFor(sessionId, root);
    const key = typeof sessionId === "string" && sessionId !== "" ? sessionId : realRoot;
    const from = this.shellCwd.get(key) ?? realRoot;
    const script = [
      `cd ${JSON.stringify(from)} 2>/dev/null || cd ${JSON.stringify(realRoot)}`,
      command,
      "__dsh_code=$?",
      `printf '\\n${CWD_MARK}%s\\n' "$PWD"`,
      "exit $__dsh_code",
    ].join("\n");

    const started = Date.now();
    const res = await exec("/bin/bash", ["-lc", script], from, this.cfg.shellTimeoutMs);
    let stdout = res.stdout;
    let cwd = from;
    const at = stdout.lastIndexOf(CWD_MARK);
    if (at >= 0) {
      const end = stdout.indexOf("\n", at);
      cwd = stdout.slice(at + CWD_MARK.length, end < 0 ? undefined : end).trim() || from;
      const head = stdout.slice(0, at);
      stdout = head.endsWith("\n") ? head.slice(0, -1) : head;
      this.shellCwd.set(key, cwd);
    }
    const merged = stdout + (res.stderr === "" ? "" : (stdout === "" ? "" : "\n") + res.stderr);
    const body = res.failed !== "" ? `${merged}\n${res.failed}` : merged;
    return {
      cwd,
      root: realRoot,
      command,
      code: res.code,
      timedOut: res.timedOut,
      durationMs: Date.now() - started,
      ...cap(body, this.cfg.maxOutputChars),
    };
  }

  @Remote("resetShell")
  async resetShell(sessionId?: string, root?: string): Promise<ResetShellResult> {
    const realRoot = await this.rootFor(sessionId, root);
    const key = typeof sessionId === "string" && sessionId !== "" ? sessionId : realRoot;
    this.shellCwd.delete(key);
    return { cwd: realRoot };
  }
}

export { DshWorkbench };
