import { createRequire } from 'node:module';
import path from 'node:path';
import { resolve } from 'node:path';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import Schema from '@deepseek-ai/schemastery';
import type { Context } from '@deepseek-ai/cordis';
import {
  getGitStatus,
  listBranchesAndWorktrees,
  getPullRequests,
  createWorktree as gitCreateWorktree,
  switchBranch as gitSwitchBranch,
} from './git.js';
import type {
  GitConfig,
  GitStatusResult,
  GitBranchItem,
  PullRequestItem,
  CreateWorktreeResult,
  SwitchBranchResult,
} from './types.js';

export * from './types.js';
export * from './git.js';

export const NAMESPACE = 'dshGit';
export const name = 'dsh-git';

export const Config: Schema<GitConfig> = Schema.object({
  ghEnabled: Schema.boolean().default(true).description('Enable GitHub CLI queries for PR and CI status'),
  gitTimeoutMs: Schema.number().default(15000).description('Timeout for git and gh queries in milliseconds'),
  autoWorktreePrefix: Schema.string().default('wt-').description('Prefix for automatically created worktrees'),
});

const METHODS = ['status', 'branches', 'pullRequests', 'createWorktree', 'switchBranch'];

const initializers: ((this: any) => void)[] = [];
for (const method of METHODS) {
  try {
    (Remote as any)(method)(undefined, {
      kind: 'method',
      name: method,
      static: false,
      private: false,
      addInitializer: (fn: any) => initializers.push(fn),
    });
  } catch {}
}

/**
 * Cross-module binding: ensure @Remote markers are registered on whichever copy
 * of @deepseek-ai/dsh-typert-protocol the host process loaded.
 */
function attachHostProtocolsSync(instance: any) {
  const home = process.env.HOME || '';
  const dshHome = process.env.DSH_HOME || path.join(home, '.dsh');
  const candidates = [
    path.join(dshHome, 'profiles/node_modules'),
    path.join(home, '.dsh/profiles/node_modules'),
    path.join(home, '.agents/tools/dsh/node_modules'),
  ];

  const seen = new Set<string>();
  for (const dir of candidates) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    try {
      const r = createRequire(path.join(dir, 'dummy.js'));
      const protoPath = r.resolve('@deepseek-ai/dsh-typert-protocol');
      if (seen.has(protoPath)) continue;
      seen.add(protoPath);
      const proto = r(protoPath);
      if (!proto || typeof proto.Remote !== 'function') continue;
      for (const method of METHODS) {
        try {
          proto.Remote(method)(undefined, {
            kind: 'method',
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

export default class DshGit extends TypertRemoteService {
  static inject = ['sessions', 'workspaceRegistry'];

  private cfg: Required<GitConfig>;

  constructor(ctx: Context, config: GitConfig = {}) {
    super(ctx, NAMESPACE);

    for (const init of initializers) {
      try { init.call(this); } catch {}
    }
    attachHostProtocolsSync(this);

    this.cfg = {
      ghEnabled: config.ghEnabled ?? true,
      gitTimeoutMs: config.gitTimeoutMs ?? 15000,
      autoWorktreePrefix: config.autoWorktreePrefix ?? 'wt-',
    };
  }

  /**
   * Safely determine and authorize root directory for git operations.
   * Priority:
   * 1. Validated workspace directory when root is provided and matches registered workspace
   * 2. Active session directory (session cwd, session workspaceId, or owning workspace in registry)
   * 3. Current process cwd (no blind workspace iteration)
   */
  async rootFor(arg1?: any, arg2?: any): Promise<string> {
    let sessionId: string | undefined;
    let root: string | undefined;

    if (typeof arg1 === 'object' && arg1 !== null) {
      sessionId = typeof arg1.sessionId === 'string' ? arg1.sessionId : undefined;
      root = typeof arg1.root === 'string' ? arg1.root : undefined;
    } else {
      sessionId = typeof arg1 === 'string' ? arg1 : undefined;
      root = typeof arg2 === 'string' ? arg2 : undefined;
    }

    // 1. Explicit root provided by client
    if (typeof root === 'string' && root.trim() !== '') {
      const target = resolve(root.trim());
      const registry = (this.ctx as any).workspaceRegistry;
      const workspaces: any[] = registry?.list?.() || [];

      // Check if target matches or is inside an explicitly registered workspace
      const authorized = workspaces.some((w) => {
        const wsPath = resolve(w.path || '');
        return target === wsPath || target.startsWith(wsPath + '/');
      });

      if (authorized || target === resolve(process.cwd())) {
        return target;
      }

      // Check if it's an accessible git repo on disk
      try {
        const st = await getGitStatus(target, 1000);
        if (st.isGit) return target;
      } catch {
        // ignore
      }

      throw new Error(`dsh-git: Access denied: path "${root}" is not within registered workspaces.`);
    }

    // 2. Session-based resolution
    if (typeof sessionId === 'string' && sessionId.trim() !== '') {
      const sid = sessionId.trim();
      const session = (this.ctx as any).sessions?.get?.(sid);
      const cwd = session?.header?.cwd;
      if (typeof cwd === 'string' && cwd !== '') return resolve(cwd);

      const wsId = session?.header?.workspaceId;
      const registry = (this.ctx as any).workspaceRegistry;
      if (wsId && registry?.get) {
        const ws = registry.get(wsId);
        if (ws?.path) return resolve(ws.path);
      }

      const workspaces: any[] = registry?.list?.() || [];
      const owningWs = workspaces.find((w) => Array.isArray(w.sessionIds) && w.sessionIds.includes(sid));
      if (owningWs?.path) return resolve(owningWs.path);
    }

    // 3. Process CWD fallback (do NOT iterate arbitrary workspaces to prevent cross-repo leaks)
    const procCwd = resolve(process.cwd());
    return procCwd;
  }

  @Remote('status')
  async status(sessionId?: string, root?: string): Promise<GitStatusResult> {
    const cwd = await this.rootFor(sessionId, root);
    return getGitStatus(cwd, this.cfg.gitTimeoutMs);
  }

  @Remote('branches')
  async branches(sessionId?: string, root?: string): Promise<{ repoName: string; currentBranch: string; items: GitBranchItem[] }> {
    const cwd = await this.rootFor(sessionId, root);
    return listBranchesAndWorktrees(cwd, this.cfg.gitTimeoutMs, this.cfg.ghEnabled);
  }

  @Remote('pullRequests')
  async pullRequests(sessionId?: string, root?: string): Promise<PullRequestItem[]> {
    if (!this.cfg.ghEnabled) return [];
    const cwd = await this.rootFor(sessionId, root);
    return getPullRequests(cwd, this.cfg.gitTimeoutMs);
  }

  @Remote('createWorktree')
  async createWorktree(
    sessionId?: string,
    root?: string,
    branch?: string,
    newBranch?: string,
    name?: string,
  ): Promise<CreateWorktreeResult & { workspaceId?: string }> {
    const cwd = await this.rootFor(sessionId, root);
    let baseBranch = branch;
    let targetNewBranch = newBranch;
    let targetName = name;
    if (typeof sessionId === 'object' && sessionId !== null) {
      const opts = sessionId as any;
      baseBranch = opts.branch ?? baseBranch;
      targetNewBranch = opts.newBranch ?? targetNewBranch;
      targetName = opts.name ?? targetName;
    }
    const res = await gitCreateWorktree(
      cwd,
      { baseBranch, newBranch: targetNewBranch, name: targetName, prefix: this.cfg.autoWorktreePrefix },
      this.cfg.gitTimeoutMs,
    );

    if (res.ok && res.worktreePath) {
      try {
        const registry = (this.ctx as any).workspaceRegistry;
        const existing = await registry?.resolveByPath?.(res.worktreePath);
        const ws = existing ?? await registry?.create?.(res.worktreePath);
        return {
          ...res,
          workspaceId: ws ? String(ws.id) : undefined,
        };
      } catch {
        // Non-fatal if workspace registry is unavailable
      }
    }

    return res;
  }

  @Remote('switchBranch')
  async switchBranch(
    sessionId?: string,
    root?: string,
    branch?: string,
  ): Promise<SwitchBranchResult> {
    const cwd = await this.rootFor(sessionId, root);
    let targetBranch = branch;
    if (typeof sessionId === 'object' && sessionId !== null && typeof (sessionId as any).branch === 'string') {
      targetBranch = (sessionId as any).branch;
    }
    if (!targetBranch) {
      return { ok: false, branch: '', error: 'Branch name is required' };
    }
    return gitSwitchBranch(cwd, targetBranch, this.cfg.gitTimeoutMs);
  }
}

export { DshGit };
