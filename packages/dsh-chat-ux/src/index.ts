import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { zstdCompress } from "node:zlib";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import Schema from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
import {
  cutBeforeTurn,
  cutAfterTurn,
  extractUserPrompt,
  findTurnStartIndex,
  type EventEnvelope,
} from "./turns.js";

const zstdCompressAsync = promisify(zstdCompress);

export interface ChatUxConfig {
  dedupSystemPrompts?: boolean;
  pageByTurn?: boolean;
  enableRollback?: boolean;
  enableFork?: boolean;
}

export const NAMESPACE = "dshChatUx";
export const name = "dsh-chat-ux";

export const Config: Schema<ChatUxConfig> = Schema.object({
  dedupSystemPrompts: Schema.boolean()
    .default(true)
    .description("Hide repeat collapsed system prompts in chat history, keeping only the initial session prompt"),
  pageByTurn: Schema.boolean()
    .default(true)
    .description("Enable loading earlier full conversation turns instead of raw 50-event chunks"),
  enableRollback: Schema.boolean()
    .default(true)
    .description("Enable Claude Code-style conversation rollback/revert from any user message"),
  enableFork: Schema.boolean()
    .default(true)
    .description("Enable conversation branching/forking from any user or assistant message"),
});

export default class DshChatUx extends TypertRemoteService {
  static inject = ["sessions"];

  private cfg: ChatUxConfig;

  constructor(ctx: Context, config: ChatUxConfig = {}) {
    super(ctx, NAMESPACE);
    this.cfg = Config(config);
  }

  private async getSessionData(sessionId: string): Promise<{
    events: readonly EventEnvelope[];
    header: Record<string, any>;
  }> {
    const live = (this.ctx as any).sessions?.get?.(sessionId);
    if (live && live.events && live.header) {
      return { events: live.events, header: live.header };
    }
    const query = this.ctx.get("sessionQuery");
    if (query && typeof query.observeSession === "function") {
      const obs = await query.observeSession(sessionId);
      return { events: obs.events, header: obs.header };
    }
    throw new Error(`Session "${sessionId}" not found`);
  }

  @Remote("getTurnInfo")
  async getTurnInfo(sessionId: string, turn: number) {
    const data = await this.getSessionData(sessionId);
    const startIndex = findTurnStartIndex(data.events, turn);
    if (startIndex === -1) {
      return { ok: false, message: `Turn ${turn} not found` };
    }
    const promptText = extractUserPrompt(data.events, startIndex);
    return { ok: true, turn, promptText, eventCount: data.events.length };
  }

  @Remote("forkBeforeTurn")
  async forkBeforeTurn(sessionId: string, turn: number) {
    const data = await this.getSessionData(sessionId);
    const { keptEvents, promptText } = cutBeforeTurn(data.events, turn);

    const childId = `session-${randomUUID()}`;
    const header = data.header || {};
    const presetId = header.agentPreset;
    const presets = this.ctx.get("agentPresets");
    let resolvedPreset: string | undefined = undefined;
    if (presets && presetId) {
      try {
        resolvedPreset = (await presets.resolve(presetId))?.id;
      } catch {
        resolvedPreset = presetId;
      }
    }
    const modelSelection = this.ctx.get("agentDefaultModel")?.currentSelection?.();
    const provider = modelSelection?.provider ?? "deepseek";
    const model = modelSelection?.model ?? "deepseek-chat";

    const agents = (this.ctx as any).agents;
    if (agents && typeof agents.create === "function") {
      await agents.create({
        sessionId: childId,
        seed: keptEvents,
        meta: {
          ...(header.cwd ? { cwd: header.cwd } : {}),
          parentSession: sessionId,
          seedLength: keptEvents.length,
          ...(resolvedPreset ? { agentPreset: resolvedPreset } : {}),
        },
        agentOptions: { provider, model },
        setup: async (agentCtx: any) => {
          if (presets && resolvedPreset) {
            await presets.mount(agentCtx, resolvedPreset);
          }
        },
      });
    } else {
      const sessions = (this.ctx as any).sessions;
      if (sessions && typeof sessions.create === "function") {
        sessions.create(childId, {
          seed: keptEvents,
          meta: {
            ...(header.cwd ? { cwd: header.cwd } : {}),
            parentSession: sessionId,
            seedLength: keptEvents.length,
          },
        });
      }
    }

    return { ok: true, childSessionId: childId, promptText };
  }

  @Remote("forkAtAssistantTurn")
  async forkAtAssistantTurn(sessionId: string, turn: number) {
    const data = await this.getSessionData(sessionId);
    const { keptEvents } = cutAfterTurn(data.events, turn);

    const childId = `session-${randomUUID()}`;
    const header = data.header || {};
    const presetId = header.agentPreset;
    const presets = this.ctx.get("agentPresets");
    let resolvedPreset: string | undefined = undefined;
    if (presets && presetId) {
      try {
        resolvedPreset = (await presets.resolve(presetId))?.id;
      } catch {
        resolvedPreset = presetId;
      }
    }
    const modelSelection = this.ctx.get("agentDefaultModel")?.currentSelection?.();
    const provider = modelSelection?.provider ?? "deepseek";
    const model = modelSelection?.model ?? "deepseek-chat";

    const agents = (this.ctx as any).agents;
    if (agents && typeof agents.create === "function") {
      await agents.create({
        sessionId: childId,
        seed: keptEvents,
        meta: {
          ...(header.cwd ? { cwd: header.cwd } : {}),
          parentSession: sessionId,
          seedLength: keptEvents.length,
          ...(resolvedPreset ? { agentPreset: resolvedPreset } : {}),
        },
        agentOptions: { provider, model },
        setup: async (agentCtx: any) => {
          if (presets && resolvedPreset) {
            await presets.mount(agentCtx, resolvedPreset);
          }
        },
      });
    }

    return { ok: true, childSessionId: childId };
  }

  @Remote("revertTurn")
  async revertTurn(sessionId: string, turn: number) {
    const data = await this.getSessionData(sessionId);
    const { keptEvents, promptText } = cutBeforeTurn(data.events, turn);

    let inPlaceSuccess = false;
    try {
      const sessionDirPattern = join(homedir(), ".dsh", "sessions");
      const projDirs = await fs.readdir(sessionDirPattern);
      let targetLogPath: string | null = null;
      for (const p of projDirs) {
        const candidate = join(sessionDirPattern, p, sessionId, "session.jsonl.zstd");
        try {
          await fs.access(candidate);
          targetLogPath = candidate;
          break;
        } catch {}
      }

      if (targetLogPath) {
        const liveAgent = (this.ctx as any).agents?.get?.(sessionId);
        if (liveAgent && typeof liveAgent.dispose === "function") {
          await liveAgent.dispose();
        }

        const headerLine =
          JSON.stringify({
            type: "session",
            version: 0,
            id: sessionId,
            createdAt: data.header.createdAt ?? Date.now(),
            ...(data.header.cwd ? { cwd: data.header.cwd } : {}),
            ...(data.header.parentSession ? { parentSession: data.header.parentSession } : {}),
            ...(data.header.origin ? { origin: data.header.origin } : {}),
            delegationDepth: data.header.delegationDepth ?? 0,
            ...(data.header.agentPreset ? { agentPreset: data.header.agentPreset } : {}),
          }) + "\n";

        const headerFrame = await zstdCompressAsync(Buffer.from(headerLine, "utf8"));
        const bodyLines = keptEvents.map((e) => JSON.stringify(e)).join("\n") + "\n";
        const bodyFrame = await zstdCompressAsync(Buffer.from(bodyLines, "utf8"));
        const finalBuf = Buffer.concat([headerFrame, bodyFrame]);

        const tmpPath = `${targetLogPath}.tmp.${Date.now()}`;
        await fs.writeFile(tmpPath, finalBuf);
        await fs.rename(tmpPath, targetLogPath);

        const projCache = join(homedir(), ".dsh", "storages", "session_projcache", "sessions", `${sessionId}.json`);
        try {
          await fs.rm(projCache, { force: true });
        } catch {}

        const header = data.header || {};
        const presets = this.ctx.get("agentPresets");
        let resolvedPreset: string | undefined = undefined;
        if (presets && header.agentPreset) {
          try {
            resolvedPreset = (await presets.resolve(header.agentPreset))?.id;
          } catch {
            resolvedPreset = header.agentPreset;
          }
        }
        const modelSelection = this.ctx.get("agentDefaultModel")?.currentSelection?.();
        const provider = modelSelection?.provider ?? "deepseek";
        const model = modelSelection?.model ?? "deepseek-chat";

        const agents = (this.ctx as any).agents;
        if (agents && typeof agents.create === "function") {
          await agents.create({
            sessionId,
            seed: keptEvents,
            meta: {
              ...(header.cwd ? { cwd: header.cwd } : {}),
              parentSession: header.parentSession,
              seedLength: keptEvents.length,
              ...(resolvedPreset ? { agentPreset: resolvedPreset } : {}),
            },
            agentOptions: { provider, model },
            setup: async (agentCtx: any) => {
              if (presets && resolvedPreset) {
                await presets.mount(agentCtx, resolvedPreset);
              }
            },
          });
        }

        inPlaceSuccess = true;
      }
    } catch {
      inPlaceSuccess = false;
    }

    if (inPlaceSuccess) {
      return { ok: true, inPlace: true, sessionId, promptText };
    }

    // Fallback: create fork before turn
    const forkRes = await this.forkBeforeTurn(sessionId, turn);
    return { ok: true, inPlace: false, childSessionId: forkRes.childSessionId, promptText };
  }
}

export function apply(ctx: Context, config: ChatUxConfig = {}) {
  ctx.plugin(DshChatUx, config);
}
