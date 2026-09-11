import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import Schema from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
import { createRequire } from "node:module";
import path from "node:path";
import { checkAllUpdates, expandHome } from "./checker.js";
import { executeUpdate } from "./installer.js";
import { restartDsh } from "./restarter.js";
import type {
  CheckUpdatesResult,
  RestartResult,
  UpdateExecutionResult,
  UpdateOptions,
  UpdateProgress,
  UpdaterConfig,
} from "./types.js";

function attachHostProtocolsSync(instance: any, config?: UpdaterConfig) {
  const home = process.env.HOME || "";
  const dshHome = process.env.DSH_HOME || path.join(home, ".dsh");
  const candidates = [
    path.join(dshHome, "profiles/node_modules"),
    path.join(home, ".dsh/profiles/node_modules"),
    path.join(home, ".agents/tools/dsh/node_modules"),
  ];
  if (config?.profilesPath) {
    candidates.unshift(path.join(expandHome(config.profilesPath), "node_modules"));
  }
  if (config?.dshInstallPath) {
    candidates.unshift(path.join(expandHome(config.dshInstallPath), "node_modules"));
  }

  const seen = new Set<string>();
  for (const dir of candidates) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    try {
      const r = createRequire(path.join(dir, "dummy.js"));
      const protoPath = r.resolve("@deepseek-ai/dsh-typert-protocol");
      if (seen.has(protoPath)) continue;
      seen.add(protoPath);
      const proto = r(protoPath);
      if (!proto || typeof proto.Remote !== "function") continue;
      for (const method of ["check", "update", "restart", "progress"]) {
        try {
          proto.Remote(method)(undefined, {
            kind: "method",
            name: method,
            static: false,
            private: false,
            addInitializer: (fn: (this: any) => void) => {
              try { fn.call(instance); } catch {}
            },
          });
        } catch {}
      }
    } catch {}
  }
}

export * from "./types.js";
export * from "./version.js";
export * from "./checker.js";
export * from "./installer.js";
export * from "./restarter.js";

export const NAMESPACE = "dshUpdater";
export const name = "dsh-updater";
export const inject = ["commands"];

export const Config: Schema<UpdaterConfig> = Schema.object({
  autoCheckIntervalMinutes: Schema.number()
    .default(60)
    .description("Interval in minutes to automatically check for updates in background"),
  enableBadge: Schema.boolean()
    .default(true)
    .description("Display update indicator badge in the GUI when updates are available"),
  enableCommands: Schema.boolean()
    .default(true)
    .description("Enable /update slash command in the chat"),
  dshInstallPath: Schema.string()
    .default("~/.agents/tools/dsh")
    .description("Path to DSH pinned installation directory containing package.json"),
  pluginsRepoPath: Schema.string()
    .default("~/projects/dsh-plugins")
    .description("Path to dsh-plugins repository"),
  profilesPath: Schema.string()
    .default("~/.dsh/profiles")
    .description("Path to DSH profiles directory"),
});

export default class DshUpdater extends TypertRemoteService {
  static inject = ["commands"];

  private config: UpdaterConfig;
  private lastCheckResult: CheckUpdatesResult | null = null;
  private lastCheckTime = 0;
  private currentProgress: UpdateProgress | null = null;

  constructor(ctx: Context, config: UpdaterConfig = {}) {
    super(ctx, NAMESPACE);
    this.config = config;
    attachHostProtocolsSync(this, config);

    if (config.enableCommands !== false) {
      this.registerCommands();
    }
  }

  @Remote("check")
  async check(force?: boolean): Promise<CheckUpdatesResult> {
    const isForce = Boolean(force);
    const now = Date.now();
    const cacheValidMs = 60 * 1000; // 1 minute cache for fast UI polling

    if (!isForce && this.lastCheckResult && now - this.lastCheckTime < cacheValidMs) {
      return this.lastCheckResult;
    }

    const result = await checkAllUpdates(this.config);
    this.lastCheckResult = result;
    this.lastCheckTime = now;
    return result;
  }

  @Remote("update")
  async update(target?: string, restart?: boolean): Promise<UpdateExecutionResult> {
    const updateTarget = (target === "plugins" || target === "dsh" || target === "all") ? target : "all";
    const shouldRestart = restart !== false;
    const options: UpdateOptions = { target: updateTarget, restart: shouldRestart };

    this.currentProgress = {
      active: true,
      target: updateTarget,
      phase: "Starting",
      percent: 0,
      currentStepIndex: 0,
      totalSteps: updateTarget === "all" ? 4 : 2,
      currentStepName: "Starting update task",
      startedAt: Date.now(),
      steps: [],
    };

    const result = await executeUpdate(options, this.config, (prog) => {
      this.currentProgress = prog;
    });

    // Refresh cached check after update
    try {
      this.lastCheckResult = await checkAllUpdates(this.config);
      this.lastCheckTime = Date.now();
    } catch {}

    if (shouldRestart && result.ok) {
      if (this.currentProgress) {
        this.currentProgress.phase = "Restarting";
        this.currentProgress.currentStepName = "Restarting DeepSeek Harness server";
        this.currentProgress.percent = 100;
      }
      // Schedule restart shortly so the RPC response delivers to the browser first
      setTimeout(() => {
        restartDsh(500);
      }, 300);
    } else if (this.currentProgress) {
      this.currentProgress.active = false;
    }

    return result;
  }

  @Remote("progress")
  progress(): UpdateProgress {
    if (!this.currentProgress) {
      return {
        active: false,
        phase: "Idle",
        percent: 0,
        currentStepIndex: 0,
        totalSteps: 0,
        currentStepName: "",
        steps: [],
      };
    }
    return this.currentProgress;
  }

  @Remote("restart")
  restart(): RestartResult {
    return restartDsh(600);
  }

  registerCommands() {
    const ctx = this.ctx as any;
    if (!ctx.commands?.register) return;

    ctx.commands.register({
      name: "update",
      description: "Check for DeepSeek Harness and plugins updates or trigger an upgrade",
      handler: async (invocation: any) => {
        const text = String(invocation.text ?? "").trim().toLowerCase();

        if (text === "now" || text === "all") {
          const res = await this.update("all", true);
          if (!res.ok) {
            return {
              kind: "error",
              text: `Update failed:\n${res.steps.map((s) => `• ${s.step}: ${s.status} ${s.error || ""}`).join("\n")}`,
            };
          }
          return {
            kind: "success",
            text: `Update completed successfully. Restarting DeepSeek Harness...\n${res.steps.map((s) => `✓ ${s.step}`).join("\n")}`,
          };
        }

        const info = await this.check(true);
        const lines: string[] = [];

        lines.push(`DeepSeek Harness: ${info.dsh.current} ${info.dsh.updateAvailable ? `→ ${info.dsh.latest} (UPDATE AVAILABLE)` : "(Up to date)"}`);
        lines.push(`Plugins (${info.plugins.items.length}): ${info.plugins.hasUpdates ? `Updates available (${info.plugins.repoBehind} commits behind)` : "All up to date"}`);

        if (info.hasAnyUpdates) {
          lines.push("\nRun '/update now' or click 'Update All & Restart' in Settings → Updates to upgrade.");
        }

        return {
          kind: "success",
          text: lines.join("\n"),
        };
      },
    });
  }
}
