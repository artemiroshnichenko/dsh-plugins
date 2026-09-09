import { readFileSync } from "node:fs";
import { release, type as osType } from "node:os";
import { createRequire } from "node:module";
import Schema from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";

export const name = "dsh-env";
export const inject = ["systemPrompt"];

export interface EnvPluginConfig {
  includeToday?: boolean;
  includePlatform?: boolean;
  includeOsVersion?: boolean;
  includeHarnessVersion?: boolean;
  customVariables?: Record<string, string>;
}

export const Config: Schema<EnvPluginConfig> = Schema.object({
  includeToday: Schema.boolean().default(true).description("Inject today calendar date into system prompt"),
  includePlatform: Schema.boolean().default(true).description("Inject operating system and architecture into system prompt"),
  includeOsVersion: Schema.boolean().default(true).description("Inject kernel name and release into system prompt"),
  includeHarnessVersion: Schema.boolean().default(true).description("Inject DSH version into system prompt"),
  customVariables: Schema.dict(Schema.string()).default({}).description("Additional static string variables for prompt"),
});

export function platformFact(): string {
  const map: Record<string, string> = { darwin: "macOS", linux: "Linux", win32: "Windows" };
  return `${map[process.platform] ?? process.platform} (${process.arch})`;
}

export function osFact(): string {
  return `${osType()} ${release()}`;
}

export function harnessFact(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("@deepseek-ai/dsh/package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return `dsh ${pkg.version}`;
  } catch {
    return "dsh (version unknown)";
  }
}

export function todayFact(now = new Date()): string {
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  return `${iso} (${weekday})`;
}

export function apply(ctx: Context, config: EnvPluginConfig = {}) {
  const {
    includeToday = true,
    includePlatform = true,
    includeOsVersion = true,
    includeHarnessVersion = true,
    customVariables = {},
  } = config;

  const platform = platformFact();
  const os = osFact();
  const harness = harnessFact();

  if (includeToday) {
    (ctx as any).effect(
      () => (ctx as any).systemPrompt.variable("today", () => todayFact()),
      "dsh-env: today"
    );
  }

  if (includePlatform) {
    (ctx as any).effect(
      () => (ctx as any).systemPrompt.variable("platform", () => platform),
      "dsh-env: platform"
    );
  }

  if (includeOsVersion) {
    (ctx as any).effect(
      () => (ctx as any).systemPrompt.variable("os_version", () => os),
      "dsh-env: os version"
    );
  }

  if (includeHarnessVersion) {
    (ctx as any).effect(
      () => (ctx as any).systemPrompt.variable("harness_version", () => harness),
      "dsh-env: harness version"
    );
  }

  for (const [key, value] of Object.entries(customVariables)) {
    (ctx as any).effect(
      () => (ctx as any).systemPrompt.variable(key, () => value),
      `dsh-env: custom variable ${key}`
    );
  }
}
