import path from "node:path";
import type {
  CompiledRules,
  GuardDecision,
  GuardEnvironment,
  GuardRule,
  PathRule,
  PluginConfig,
  RuleInput,
} from "./types.js";

/** Sensitive paths and secret files that should never be read or written. */
export const DEFAULT_DENY_PATHS: string[] = [
  "~/.ssh/**",
  "~/.gnupg/**",
  "~/.aws/**",
  "~/.config/gh/**",
  "~/.config/infisical/**",
  "~/.kube/config",
  "~/.netrc",
  "~/.npmrc",
  "~/.pypirc",
  "~/.git-credentials",
  "~/.docker/config.json",
  "~/.dsh/.credentials.yaml",
  "~/.claude/.credentials.json",
  "~/.config/opencode/auth.json",
  "~/.openviking/ovcli.conf",
  "**/.env",
  "**/.env.*",
  "**/*.pem",
  "**/*.p12",
  "**/*.pfx",
  "**/id_rsa*",
  "**/id_ed25519*",
  "**/id_ecdsa*",
  "**/credentials.yaml",
  "**/.credentials.json",
];

/** Commands that must never be executed under any circumstance. */
export const DEFAULT_DENY_COMMANDS: GuardRule[] = [
  { id: "rm-root", re: new RegExp("\\brm\\s+-[a-zA-Z]*[rR][a-zA-Z]*\\s+(-[a-zA-Z]+\\s+)*[\"']?\\/+[\"']?(\\s|$)"), reason: "attempting to delete filesystem root" },
  { id: "mkfs", re: new RegExp("\\bmk" + "fs(\\.\\w+)?\\b"), reason: "formatting filesystem" },
  { id: "dd-device", re: new RegExp("\\bdd\\b[^|;&]*\\bof=\\/dev\\/"), reason: "writing directly to raw block device" },
  { id: "redirect-device", re: new RegExp(">\\s*\\/dev\\/(sd|disk|nvme|mmcblk)"), reason: "redirecting output to raw block device" },
  { id: "fork-bomb", re: new RegExp(":\\s*\\(\\s*\\)\\s*\\{[^}]*:\\s*\\|\\s*:[^}]*\\}"), reason: "fork bomb pattern detected" },
  { id: "chmod-root", re: new RegExp("\\bchmod\\s+(-R\\s+)?[0-7]{3,4}\\s+[\"']?\\/+[\"']?(\\s|$)"), reason: "changing permissions recursively from root" },
];

/** Commands that require explicit human approval before execution. */
export const DEFAULT_ASK_COMMANDS: GuardRule[] = [
  { id: "ssh-mutate", re: new RegExp("\\bssh\\s+[^|;&]*(\\b(rm|reboot|shutdown|halt|poweroff|tee|dd|shred|mkfs|mv)\\b|\\bcrontab\\s+-[re]\\b|\\b(systemctl|service|launchctl)\\s+(restart|stop|start|reload|kill|enable|disable)\\b|\\b(apt|apt-get|dnf|yum|brew)\\s+(install|remove|purge|upgrade)\\b|\\bdocker(\\s+compose)?\\s+(rm|rmi|down|stop|restart|kill|system\\s+prune)\\b|\\s>\\s*\\S)"), reason: "mutating action on remote host over SSH" },
  { id: "rm-recursive", re: new RegExp("\\brm\\s+(-[a-zA-Z]*[rRf][a-zA-Z]*\\s+)+"), reason: "recursive or forced file deletion" },
  { id: "git-push", re: new RegExp("\\bgit\\s+push\\b"), reason: "pushing to remote git repository" },
  { id: "git-discard", re: new RegExp("\\bgit\\s+(reset\\s+--hard|clean\\b|checkout\\s+--\\s|restore\\s+\\.|branch\\s+-D|stash\\s+drop|stash\\s+clear)"), reason: "discarding uncommitted working tree changes" },
  { id: "git-history", re: new RegExp("\\bgit\\s+(rebase\\b|filter-branch\\b|commit\\b[^|;&]*--amend|commit\\b[^|;&]*--no-verify)"), reason: "rewriting git commit history" },
  { id: "git-remote", re: new RegExp("\\bgit\\s+remote\\s+(add|remove|rm|set-url)\\b"), reason: "modifying git remote configuration" },
  { id: "service", re: new RegExp("\\b(systemctl|service|launchctl|brew\\s+services)\\s+(restart|stop|start|reload|kill|unload|bootout|enable|disable)\\b"), reason: "managing live system service or daemon" },
  { id: "docker-mutate", re: new RegExp("\\bdocker(\\s+compose)?\\s+(rm|rmi|down|system\\s+prune|kill|stop|restart|volume\\s+rm|network\\s+rm)\\b"), reason: "modifying or stopping container workloads" },
  { id: "publish", re: new RegExp("\\b(npm|pnpm|yarn)\\s+publish\\b|\\bcargo\\s+publish\\b|\\btwine\\s+upload\\b"), reason: "publishing package to public registry" },
  { id: "gh-outward", re: new RegExp("\\bgh\\s+(pr\\s+(create|merge|close)|release\\b|repo\\s+(delete|create))"), reason: "outward GitHub repository or pull request action" },
  { id: "install", re: new RegExp("\\b(brew|apt|apt-get|dnf|yum|pacman)\\s+(install|remove|uninstall|upgrade|purge)\\b|\\bpip3?\\s+install\\b|\\bnpm\\s+(i|install)\\s+(-g|--global)\\b|\\bcargo\\s+install\\b|\\bcurl\\b[^|]*\\|\\s*(ba)?sh\\b"), reason: "installing or removing system packages" },
  { id: "curl-mutate", re: new RegExp("\\b(curl|wget|http)\\b[^|;&]*(\\s-X\\s*(POST|PUT|DELETE|PATCH)\\b|\\s--data\\b|\\s-d\\s|\\s--upload-file\\b|\\s-T\\s|\\s--post-data\\b|\\s--method\\s*=?\\s*(POST|PUT|DELETE))", "i"), reason: "sending external HTTP mutation" },
  { id: "sudo", re: new RegExp("\\b(sudo|doas)\\b"), reason: "elevating privileges with sudo/doas" },
  { id: "power", re: new RegExp("\\b(reboot|shutdown|halt|poweroff)\\b"), reason: "rebooting or shutting down machine" },
  { id: "kill", re: new RegExp("\\b(kill|killall|pkill)\\b"), reason: "killing operating system processes" },
  { id: "cron", re: new RegExp("\\bcrontab\\s+-[re]\\b"), reason: "modifying cron schedule" },
  { id: "destroy-data", re: new RegExp("\\b(shred|truncate\\s+-s\\s*0)\\b"), reason: "destructive file wiping or truncation" },
  { id: "etc-write", re: new RegExp("(>|\\btee\\b)\\s*[\"']?\\/etc\\/"), reason: "modifying system configuration in /etc" },
  { id: "sql-drop", re: new RegExp("\\b(DROP\\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\\s+TABLE)\\b", "i"), reason: "dropping database, schema, or table" },
];

/** Tool name to arguments mapping containing file paths. */
export const PATH_ARGS: Record<string, string[]> = {
  read: ["file_path"],
  write: ["file_path"],
  edit: ["file_path"],
  str_replace_editor: ["path"],
  glob: ["path", "pattern"],
  grep: ["path"],
};

/** Tool name to arguments mapping containing shell commands. */
export const COMMAND_ARGS: Record<string, string[]> = {
  bash: ["command"],
  bash_persistent: ["command"],
  pwsh: ["command"],
  pwsh_persistent: ["command"],
};

/** Expands ~ and $HOME prefixes in a path. */
export function expandHome(p: string, home: string): string {
  if (typeof p !== "string") return p;
  if (p === "~") return home;
  if (p.startsWith("~/")) return path.posix.join(home, p.slice(2));
  return p.replace(/\$\{?HOME\}?/g, home);
}

/** Normalizes a path string to an absolute POSIX path. */
export function normalizePath(p: string, { cwd, home }: GuardEnvironment): string {
  let s = expandHome(String(p).trim().replace(/^["']|["']$/g, ""), home);
  if (!path.posix.isAbsolute(s)) {
    s = path.posix.join(cwd, s);
  }
  return path.posix.normalize(s);
}

/** Compiles a glob pattern to a case-insensitive RegExp matching whole paths. */
export function globToRegExp(glob: string, home: string): RegExp {
  const g = expandHome(glob, home);
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        i++;
        if (g[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else if (re.endsWith("/")) {
          re = re.slice(0, -1) + "(?:/.*)?";
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$", "i");
}

/** Compiles an array of glob strings into path rules. */
export function compilePathRules(patterns: string[], home: string): PathRule[] {
  return patterns.map((p) => ({ pattern: p, re: globToRegExp(p, home) }));
}

/** Returns the pattern of the first matched deny rule, or null if allowed. */
export function pathDenied(p: string, rules: PathRule[], env: GuardEnvironment): string | null {
  const abs = normalizePath(p, env);
  for (const r of rules) {
    if (r.re.test(abs)) return r.pattern;
  }
  return null;
}

/** Extracts all path-like tokens and secret filenames from a command string. */
export function pathsInCommand(cmd: string, home: string): string[] {
  const out = new Set<string>();
  // Strip URLs to prevent false positives like https://example.com/test.pem
  const src = String(cmd)
    .replace(/\$\{?HOME\}?/g, home)
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, " ");

  // Absolute, home-relative, or dotted relative paths
  for (const m of src.matchAll(/(?:~\/|\.{1,2}\/|\/)[A-Za-z0-9_./~+@%-]*/g)) {
    out.add(m[0]);
  }
  // Standalone path segments
  for (const m of src.matchAll(/(?<![A-Za-z0-9_./~$-])([A-Za-z0-9_][A-Za-z0-9_.-]*)(?![A-Za-z0-9_./-])/g)) {
    out.add(m[1]);
  }
  // Standalone secret filenames
  for (const m of src.matchAll(/(?<![A-Za-z0-9_./-])(\.env(?:\.[A-Za-z0-9_-]+)?|id_rsa[A-Za-z0-9_.-]*|id_ed25519[A-Za-z0-9_.-]*|id_ecdsa[A-Za-z0-9_.-]*|credentials\.yaml|\.credentials\.json|[A-Za-z0-9_.-]+\.(?:pem|p12|pfx))(?![A-Za-z0-9_./-])/g)) {
    out.add(m[1]);
  }
  return [...out];
}

/** Normalizes user rule inputs into compiled regex rules. */
function normalizeRules(rules: (RuleInput | GuardRule)[]): GuardRule[] {
  return rules.map((r) => {
    if (r.re instanceof RegExp) return r as GuardRule;
    return {
      id: r.id,
      re: new RegExp(r.re, (r as RuleInput).flags ?? ""),
      reason: r.reason,
    };
  });
}

/** Builds the complete set of compiled rules merging defaults with configuration. */
export function buildRules(config: PluginConfig & { home: string }): CompiledRules {
  const { denyPaths = [], askCommands = [], denyCommands = [], home } = config;
  return {
    paths: compilePathRules([...DEFAULT_DENY_PATHS, ...denyPaths], home),
    ask: [...DEFAULT_ASK_COMMANDS, ...normalizeRules(askCommands)],
    deny: [...DEFAULT_DENY_COMMANDS, ...normalizeRules(denyCommands)],
  };
}

/** Evaluates filesystem tool invocations. */
export function checkFsCall(
  name: string,
  args: Record<string, unknown> | null | undefined,
  env: GuardEnvironment,
  rules: CompiledRules
): GuardDecision | null {
  const fields = PATH_ARGS[name];
  if (!fields || !args) return null;
  for (const f of fields) {
    const v = args[f];
    if (typeof v !== "string" || !v) continue;
    if (f === "pattern" && !v.includes("/") && !v.startsWith("~")) continue;
    const hit = pathDenied(v, rules.paths, env);
    if (hit) {
      return {
        verdict: "deny",
        rule: hit,
        reason: `dsh-guard: access to restricted path denied (rule: ${hit})`,
      };
    }
  }
  return null;
}

/** Evaluates shell command string: strict denials, path violations, then approval requirements. */
export function checkCommand(
  cmd: string | null | undefined,
  env: GuardEnvironment,
  rules: CompiledRules
): GuardDecision | null {
  if (typeof cmd !== "string" || !cmd.trim()) return null;

  for (const r of rules.deny) {
    if (r.re.test(cmd)) {
      return {
        verdict: "deny",
        rule: r.id,
        reason: `dsh-guard: ${r.reason}, command strictly denied`,
      };
    }
  }

  const cwdHit = pathDenied(env.cwd, rules.paths, env);
  if (cwdHit) {
    return {
      verdict: "deny",
      rule: cwdHit,
      reason: `dsh-guard: current working directory is inside restricted path (rule: ${cwdHit})`,
    };
  }

  for (const p of pathsInCommand(cmd, env.home)) {
    const hit = pathDenied(p, rules.paths, env);
    if (hit) {
      return {
        verdict: "deny",
        rule: hit,
        reason: `dsh-guard: command references restricted path (rule: ${hit})`,
      };
    }
  }

  for (const r of rules.ask) {
    if (r.re.test(cmd)) {
      return {
        verdict: "ask",
        rule: r.id,
        reason: `dsh-guard: ${r.reason}`,
      };
    }
  }

  return null;
}

/** Top-level evaluator for all tool calls. */
export function evaluate(
  name: string,
  args: Record<string, unknown> | null | undefined,
  env: GuardEnvironment,
  rules: CompiledRules
): GuardDecision | null {
  if (COMMAND_ARGS[name]) {
    const workdir = args?.workdir;
    const resolvedCwd =
      typeof workdir === "string" && workdir
        ? normalizePath(workdir, env)
        : env.cwd;
    const e = { ...env, cwd: resolvedCwd };

    for (const f of COMMAND_ARGS[name]) {
      const cmd = args?.[f];
      if (typeof cmd === "string") {
        const r = checkCommand(cmd, e, rules);
        if (r) return r;
      }
    }
    return null;
  }

  if (name === "web_fetch" && typeof args?.url === "string" && args.url.startsWith("file://")) {
    const hit = pathDenied(args.url.slice(7), rules.paths, env);
    if (hit) {
      return {
        verdict: "deny",
        rule: hit,
        reason: `dsh-guard: access to restricted path denied (rule: ${hit})`,
      };
    }
  }

  return checkFsCall(name, args, env, rules);
}
