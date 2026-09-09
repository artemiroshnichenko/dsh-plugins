export interface ConsoleConfig {
  /** Enable /skills and /mcp slash commands in conversation. Defaults to true. */
  enableCommands?: boolean;
}

export interface SkillSummary {
  name: string;
  description: string;
  source: string;
  scope: string;
  provider: string;
  modelInvocable: boolean;
  userInvocable: boolean;
  whenToUse?: string;
}

export interface SkillsResult {
  cwd: string;
  total: number;
  project: number;
  user: number;
  skills: SkillSummary[];
}

export interface McpServerInfo {
  id: string;
  serverName: string;
  transport: string;
  target: string;
  disabled: boolean;
  phase: string | null;
  state: string;
  toolCount: number;
  tools: string[];
}

export interface McpResult {
  servers: McpServerInfo[];
  connected: number;
  totalTools: number;
}
