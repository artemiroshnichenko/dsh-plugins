import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import Schema from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
import type {
  ConsoleConfig,
  McpResult,
  McpServerInfo,
  SkillsResult,
  SkillSummary,
} from "./types.js";

export * from "./types.js";

export const NAMESPACE = "dshConsole";
export const name = "dsh-console";
export const inject = ["skills", "tools", "loader", "commands", "agentPresets"];

export const Config: Schema<ConsoleConfig> = Schema.object({
  enableCommands: Schema.boolean().default(true).description("Enable /skills and /mcp slash commands"),
});

const MCP_PLUGIN = "@deepseek-ai/dsh-mcp-client";
const FIBER_PHASE: Record<number, string> = {
  0: "pending",
  1: "loading",
  2: "active",
  3: "failed",
  4: "disposed",
  5: "unloading",
};

export function scopeOf(source: unknown): string {
  if (typeof source !== "string") return "other";
  if (source.startsWith("project")) return "project";
  if (source.startsWith("user")) return "user";
  return source;
}

export function oneLine(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

export function summarizeSkill(skill: any): SkillSummary {
  const out: SkillSummary = {
    name: skill.name,
    description: oneLine(skill.description),
    source: String(skill.source ?? ""),
    scope: scopeOf(skill.source),
    provider: String(skill.provider ?? ""),
    modelInvocable: skill.invocation?.modelInvocable !== false,
    userInvocable: skill.invocation?.userInvocable !== false,
  };
  if (typeof skill.whenToUse === "string" && skill.whenToUse !== "") {
    out.whenToUse = oneLine(skill.whenToUse);
  }
  return out;
}

function pad(text: unknown, width: number): string {
  const s = String(text);
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

export default class DshConsole extends TypertRemoteService {
  static inject = ["skills", "tools", "loader", "commands", "agentPresets"];

  constructor(ctx: Context, config: ConsoleConfig = {}) {
    super(ctx, NAMESPACE);
    if (config.enableCommands !== false) {
      this.registerCommands();
    }
  }

  async presetScope(id?: string): Promise<string | undefined> {
    try {
      return await (this.ctx as any).agentPresets?.standingKeyFor?.(id);
    } catch {
      return undefined;
    }
  }

  @Remote("skills")
  async skills(cwd?: string, signal?: AbortSignal): Promise<SkillsResult> {
    const dir = typeof cwd === "string" && cwd.trim() !== "" ? cwd.trim() : process.cwd();
    const scope = await this.presetScope();
    const list = await (this.ctx as any).skills.list({ cwd: dir, scope, signal });
    const skills = list.map(summarizeSkill);
    return {
      cwd: dir,
      total: skills.length,
      project: skills.filter((s: SkillSummary) => s.scope === "project").length,
      user: skills.filter((s: SkillSummary) => s.scope === "user").length,
      skills,
    };
  }

  @Remote("mcp")
  mcp(): McpResult {
    const tools = (this.ctx as any).tools.schemas();
    const servers: McpServerInfo[] = [];

    for (const entry of (this.ctx as any).loader.entries()) {
      if (entry.options?.name !== MCP_PLUGIN) continue;
      const cfg = entry.options.config ?? {};
      const serverName = typeof cfg.serverName === "string" ? cfg.serverName : String(entry.id);
      const prefix = `mcp__${serverName}__`;
      const names = tools
        .filter((t: any) => t.name.startsWith(prefix))
        .map((t: any) => t.name)
        .sort();
      const phase =
        entry.fiber === undefined
          ? null
          : FIBER_PHASE[entry.fiber.state] ?? String(entry.fiber.state);
      const disabled = entry.disabled === true;
      const transport = String(cfg.transport ?? "?");
      const target =
        transport === "stdio"
          ? [cfg.command, ...(Array.isArray(cfg.args) ? cfg.args : [])]
              .filter((x: unknown) => typeof x === "string")
              .join(" ")
          : String(cfg.url ?? "");
      const state = disabled
        ? "disabled"
        : phase === "failed"
        ? "error"
        : names.length > 0
        ? "connected"
        : phase === "active"
        ? "no-tools"
        : phase ?? "unknown";

      servers.push({
        id: String(entry.id),
        serverName,
        transport,
        target,
        disabled,
        phase,
        state,
        toolCount: names.length,
        tools: names,
      });
    }

    servers.sort((a, b) => a.serverName.localeCompare(b.serverName));
    return {
      servers,
      connected: servers.filter((s) => s.state === "connected").length,
      totalTools: tools.filter((t: any) => t.name.startsWith("mcp__")).length,
    };
  }

  registerCommands() {
    const ctx = this.ctx as any;
    ctx.commands.register({
      name: "skills",
      description: "List the skills available in this session (global + project)",
      handler: async (invocation: any) => {
        const agent = invocation.agent;
        const cwd = agent?.session?.header?.cwd ?? process.cwd();
        let presetId: string | undefined;
        try {
          presetId = ctx.agentPresets?.composedPreset?.(agent.ctx);
        } catch {
          presetId = undefined;
        }
        const scope = await this.presetScope(presetId);
        const list = (
          await ctx.skills.list({ cwd, scope, signal: invocation.signal })
        ).map(summarizeSkill);
        const width = Math.min(40, Math.max(8, ...list.map((s: SkillSummary) => s.name.length + 1)));
        const lines = list.map(
          (s: SkillSummary) => `${pad("/" + s.name, width)}  ${pad(s.scope, 7)}  ${s.description}`
        );
        return {
          kind: "success",
          text:
            `${list.length} skills (${
              list.filter((s: SkillSummary) => s.scope === "project").length
            } project, ${
              list.filter((s: SkillSummary) => s.scope === "user").length
            } user) for ${cwd}\n` + lines.join("\n"),
        };
      },
    });

    ctx.commands.register({
      name: "mcp",
      description: "Show the MCP servers of this deployment and whether they are connected",
      handler: () => {
        const { servers, connected, totalTools } = this.mcp();
        if (servers.length === 0) {
          return { kind: "success", text: "No MCP servers in this composition." };
        }
        const width = Math.max(...servers.map((s) => s.serverName.length)) + 1;
        const lines = servers.map((s) => {
          const mark = s.state === "connected" ? "●" : s.state === "disabled" ? "–" : "○";
          const note = s.state === "connected" ? `${s.toolCount} tools` : s.state;
          return `${mark} ${pad(s.serverName, width)} ${pad(s.transport, 16)} ${pad(note, 11)} ${s.target}`;
        });
        return {
          kind: "success",
          text: `${connected}/${servers.length} MCP servers connected, ${totalTools} tools\n` + lines.join("\n"),
        };
      },
    });
  }
}

export { DshConsole };
