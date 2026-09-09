import { realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

/** Directory names that should not be recursed into by default. */
export const DEFAULT_SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".tox",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".gradle",
  ".idea",
  ".DS_Store",
]);

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "json", "jsonc", "json5", "yaml", "yml", "toml", "ini", "cfg", "conf",
  "env", "properties", "js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts", "py", "pyi", "rs",
  "go", "rb", "php", "java", "kt", "kts", "swift", "c", "h", "cc", "cpp", "hpp", "cs", "sh", "bash",
  "zsh", "fish", "sql", "html", "htm", "css", "scss", "sass", "less", "vue", "svelte", "xml", "svg",
  "graphql", "gql", "proto", "lua", "r", "jl", "tf", "tfvars", "hcl", "dockerfile", "gitignore",
  "gitattributes", "editorconfig", "lock", "log", "csv", "tsv", "diff", "patch", "make", "mk", "gemspec",
]);

const TEXT_NAMES = new Set([
  "Dockerfile", "Makefile", "Justfile", "Procfile", "LICENSE", "NOTICE", "README", "CHANGELOG",
  ".gitignore", ".gitattributes", ".editorconfig", ".env", ".npmrc", ".nvmrc", ".prettierrc", ".eslintrc",
]);

/** Language hint for syntax highlighting, derived from file extension or name. */
export function languageOf(name: string): string {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  const map: Record<string, string> = {
    js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
    ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
    py: "python", pyi: "python", rs: "rust", go: "go", rb: "ruby", sh: "bash", bash: "bash",
    zsh: "bash", yml: "yaml", yaml: "yaml", md: "markdown", markdown: "markdown", json: "json",
    jsonc: "json", sql: "sql", html: "html", htm: "html", css: "css", scss: "scss", toml: "toml",
    tf: "hcl", hcl: "hcl", java: "java", kt: "kotlin", c: "c", h: "c", cc: "cpp", cpp: "cpp",
    hpp: "cpp", cs: "csharp", php: "php", swift: "swift", lua: "lua", xml: "xml", svg: "xml",
    diff: "diff", patch: "diff",
  };
  if (map[ext] !== undefined) return map[ext];
  if (name === "Dockerfile") return "dockerfile";
  if (name === "Makefile" || name === "Justfile") return "makefile";
  return "";
}

/** Determines whether a file is likely to be textual and editable. */
export function looksTextual(name: string): boolean {
  if (TEXT_NAMES.has(name)) return true;
  if (name.startsWith(".") && !name.includes(".", 1)) return true;
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  return ext !== "" && TEXT_EXT.has(ext);
}

/** Validates and resolves the working directory to a real absolute path. */
export async function resolveRoot(root: string | undefined): Promise<string> {
  if (typeof root !== "string" || root.trim() === "") {
    throw new Error("workbench: no working directory specified");
  }
  const abs = resolve(root.trim());
  if (!isAbsolute(abs)) {
    throw new Error(`workbench: working directory must be absolute: ${root}`);
  }
  let real: string;
  try {
    real = await realpath(abs);
  } catch {
    throw new Error(`workbench: working directory does not exist: ${abs}`);
  }
  const info = await stat(real);
  if (!info.isDirectory()) {
    throw new Error(`workbench: working directory is not a directory: ${abs}`);
  }
  return real;
}

export interface ConfinedPath {
  path: string;
  rel: string;
  exists: boolean;
}

/**
 * Ensures a relative path stays confined within the designated real root.
 * Prevents directory traversal (`..`) and symlink escapes.
 */
export async function confine(realRoot: string, rel: string | undefined): Promise<ConfinedPath> {
  const wanted = typeof rel === "string" ? rel.replace(/^[/\\]+/, "") : "";
  const target = wanted === "" || wanted === "." ? realRoot : join(realRoot, wanted);
  const lexical = relative(realRoot, target);
  if (lexical.startsWith("..") || isAbsolute(lexical)) {
    throw new Error(`workbench: path escapes working directory: ${rel}`);
  }
  let real: string;
  try {
    real = await realpath(target);
  } catch {
    return { path: target, rel: lexical, exists: false };
  }
  const realRel = relative(realRoot, real);
  if (real !== realRoot && (realRel.startsWith("..") || isAbsolute(realRel))) {
    throw new Error(`workbench: path resolves outside working directory: ${rel}`);
  }
  return { path: real, rel: real === realRoot ? "" : realRel, exists: true };
}

/** Version tag based on mtime and size to detect concurrent modifications. */
export function versionOf(info: { mtimeMs: number; size: number }): string {
  return `${info.mtimeMs}:${info.size}`;
}

export const SEP = sep;
