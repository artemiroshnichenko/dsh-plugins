import os from "node:os";
import Schema from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
import { buildRules, evaluate } from "./rules.js";
import type { PluginConfig } from "./types.js";

export * from "./types.js";
export * from "./rules.js";

export const name = "dsh-guard";
export const inject = ["tools"];

export const Config: Schema<PluginConfig> = Schema.object({
  denyPaths: Schema.array(Schema.string()).default([]).description("Additional restricted path glob patterns"),
  denyCommands: Schema.array(
    Schema.object({
      id: Schema.string().required().description("Unique rule identifier"),
      re: Schema.string().required().description("Regular expression pattern"),
      flags: Schema.string().default("").description("RegExp flags"),
      reason: Schema.string().required().description("Human-readable refusal reason"),
    })
  ).default([]).description("Additional commands to strictly deny"),
  askCommands: Schema.array(
    Schema.object({
      id: Schema.string().required().description("Unique rule identifier"),
      re: Schema.string().required().description("Regular expression pattern"),
      flags: Schema.string().default("").description("RegExp flags"),
      reason: Schema.string().required().description("Reason shown in user approval prompt"),
    })
  ).default([]).description("Additional commands requiring user approval"),
  logDecisions: Schema.boolean().default(true).description("Log guard decisions to console.warn"),
});

interface ToolExecution {
  name: string;
  arguments?: Record<string, unknown>;
  agent?: {
    cwd?: string;
    session?: {
      header?: {
        cwd?: string;
      };
    };
  };
}

function envFor(exec: ToolExecution) {
  const home = os.homedir();
  const cwd =
    exec?.agent?.session?.header?.cwd ??
    exec?.agent?.cwd ??
    process.cwd();
  return { cwd, home };
}

function summarize(exec: ToolExecution): string {
  const a = exec.arguments ?? {};
  const key = a.file_path ?? a.path ?? a.command ?? a.url ?? "";
  const s = String(key).replace(/\s+/g, " ");
  return s.length > 90 ? s.slice(0, 87) + "…" : s;
}

export function apply(ctx: Context, config: PluginConfig = {}) {
  const rules = buildRules({ ...config, home: os.homedir() });
  const log = config.logDecisions === false ? () => {} : (m: string) => console.warn(`[dsh-guard] ${m}`);

  // Monotonic tool guard: synchronous, irreversible denial
  (ctx as any).tools.guard((exec: ToolExecution) => {
    const r = evaluate(exec.name, exec.arguments, envFor(exec), rules);
    if (r?.verdict === "deny") {
      log(`deny ${exec.name} [${r.rule}] ${summarize(exec)}`);
      return r.reason;
    }
    return undefined;
  });

  // Pre-execute waterfall: handles denial and approval prompt triggering
  ctx.on("tools/pre-execute" as any, async (exec: ToolExecution, next: () => Promise<unknown>) => {
    const r = evaluate(exec.name, exec.arguments, envFor(exec), rules);
    if (r?.verdict === "deny") {
      log(`deny ${exec.name} [${r.rule}] ${summarize(exec)}`);
      return { kind: "deny", reason: r.reason };
    }
    if (r?.verdict === "ask") {
      log(`ask  ${exec.name} [${r.rule}] ${summarize(exec)}`);
      return { kind: "ask", reason: r.reason };
    }
    return next();
  });
}
