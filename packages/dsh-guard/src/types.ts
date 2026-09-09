export type GuardVerdict = "deny" | "ask";

export interface GuardDecision {
  verdict: GuardVerdict;
  rule: string;
  reason: string;
}

export interface GuardRule {
  id: string;
  re: RegExp;
  reason: string;
}

export interface ConfigRuleInput {
  id: string;
  re: string;
  flags?: string;
  reason: string;
}

export interface RuleInput {
  id: string;
  re: string | RegExp;
  flags?: string;
  reason: string;
}

export interface PathRule {
  pattern: string;
  re: RegExp;
}

export interface GuardEnvironment {
  cwd: string;
  home: string;
}

export interface CompiledRules {
  paths: PathRule[];
  ask: GuardRule[];
  deny: GuardRule[];
}

export interface PluginConfig {
  /** Additional glob patterns for restricted file paths. */
  denyPaths?: string[];
  /** Additional command rules that should always be strictly denied. */
  denyCommands?: ConfigRuleInput[];
  /** Additional command rules that require user approval before execution. */
  askCommands?: ConfigRuleInput[];
  /** Log guard decisions to console.warn. Defaults to true. */
  logDecisions?: boolean;
}
