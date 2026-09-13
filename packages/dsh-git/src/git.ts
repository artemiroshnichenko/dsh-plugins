import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type {
  CiStatus,
  CreateWorktreeResult,
  ExecResult,
  GitBranchItem,
  GitStatusResult,
  PullRequestItem,
  SwitchBranchResult,
} from './types.js';

export function exec(
  file: string,
  args: readonly string[],
  cwd?: string,
  timeoutMs = 15000,
): Promise<ExecResult> {
  return new Promise((res) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let timer: NodeJS.Timeout | null = null;

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(file, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' },
      });
    } catch (err: any) {
      return res({
        code: 1,
        stdout: '',
        stderr: '',
        timedOut: false,
        failed: `Failed to spawn ${file}: ${err?.message || String(err)}`,
      });
    }

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore kill errors
        }
      }, timeoutMs);
    }

    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err: any) => {
      if (timer) clearTimeout(timer);
      const isEnoent = err?.code === 'ENOENT';
      res({
        code: isEnoent ? 127 : 1,
        stdout,
        stderr,
        timedOut,
        failed: isEnoent
          ? `Command not found: ${file}`
          : `Failed to run ${file}: ${err?.message || String(err)}`,
      });
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      res({
        code: timedOut ? 124 : (code ?? 0),
        stdout,
        stderr,
        timedOut,
        failed: timedOut ? `Command timed out after ${timeoutMs}ms` : '',
      });
    });
  });
}

/** Check whether directory is inside a Git repository and fetch basic status */
export async function getGitStatus(cwd: string, timeoutMs = 15000): Promise<GitStatusResult> {
  const check = await exec(
    'git',
    ['rev-parse', '--is-inside-work-tree', '--show-toplevel', '--abbrev-ref', 'HEAD'],
    cwd,
    timeoutMs,
  );

  if (check.timedOut) {
    return {
      isGit: false,
      branch: '',
      repoName: '',
      root: '',
      clean: true,
      isWorktree: false,
      error: check.failed,
    };
  }

  const lines = check.stdout.trim().split(/\r?\n/);
  if (check.code !== 0 || lines[0] !== 'true') {
    return {
      isGit: false,
      branch: '',
      repoName: '',
      root: '',
      clean: true,
      isWorktree: false,
      error: check.failed || (check.code !== 0 ? check.stderr.trim() : undefined),
    };
  }

  const root = lines[1] ? resolve(lines[1]) : '';
  const branch = lines[2] || '';
  const repoName = root ? root.split('/').filter(Boolean).pop() || '' : '';

  // Check if this repository is a linked worktree (git-dir is a file, or git-common-dir differs from git-dir)
  const wtCheck = await exec(
    'git',
    ['rev-parse', '--git-dir', '--git-common-dir'],
    cwd,
    timeoutMs,
  );
  let isWorktree = false;
  if (wtCheck.code === 0) {
    const wtLines = wtCheck.stdout.trim().split(/\r?\n/);
    if (wtLines.length >= 2) {
      const gitDir = resolve(cwd, wtLines[0]);
      const gitCommonDir = resolve(cwd, wtLines[1]);
      isWorktree = gitDir !== gitCommonDir;
    }
  }

  // Check if working directory is clean
  const statusRes = await exec('git', ['status', '--porcelain=v1'], cwd, timeoutMs);
  const clean = statusRes.code === 0 && statusRes.stdout.trim() === '';

  return {
    isGit: true,
    branch,
    repoName,
    root,
    clean,
    isWorktree,
  };
}

/** List branches and worktrees in repository */
export async function listBranchesAndWorktrees(
  cwd: string,
  timeoutMs = 15000,
  ghEnabled = true,
): Promise<{ repoName: string; currentBranch: string; items: GitBranchItem[] }> {
  const status = await getGitStatus(cwd, timeoutMs);
  if (!status.isGit) {
    return { repoName: '', currentBranch: '', items: [] };
  }

  const itemsMap = new Map<string, GitBranchItem>();

  // 1. Get worktrees via porcelain format
  const wtRes = await exec('git', ['worktree', 'list', '--porcelain'], cwd, timeoutMs);
  if (wtRes.code === 0) {
    const blocks = wtRes.stdout.trim().split(/\r?\n\r?\n/);
    for (const block of blocks) {
      const lines = block.split(/\r?\n/);
      let wtPath = '';
      let branchRef = '';
      for (const line of lines) {
        if (line.startsWith('worktree ')) wtPath = resolve(line.slice('worktree '.length).trim());
        else if (line.startsWith('branch ')) branchRef = line.slice('branch '.length).trim();
      }
      if (!branchRef) continue;
      const branchName = branchRef.replace(/^refs\/heads\//, '');
      const isCurrent = wtPath === resolve(status.root) || branchName === status.branch;
      // The main worktree path is status.root; linked worktrees are wtPath !== status.root
      const isLinkedWorktree = wtPath !== resolve(status.root);

      itemsMap.set(branchName, {
        name: branchName,
        current: isCurrent,
        isWorktree: isLinkedWorktree,
        worktreePath: isLinkedWorktree ? wtPath : undefined,
      });
    }
  }

  // 2. Get local branches
  const brRes = await exec('git', ['branch', '--list', '--format=%(refname:short)'], cwd, timeoutMs);
  if (brRes.code === 0) {
    const brLines = brRes.stdout.trim().split(/\r?\n/).filter(Boolean);
    for (const b of brLines) {
      if (!itemsMap.has(b)) {
        itemsMap.set(b, {
          name: b,
          current: b === status.branch,
          isWorktree: false,
        });
      }
    }
  }

  // 3. Annotate with PR details if gh is enabled
  if (ghEnabled) {
    const prs = await getPullRequests(cwd, timeoutMs);
    for (const pr of prs) {
      if (itemsMap.has(pr.branch)) {
        const item = itemsMap.get(pr.branch)!;
        item.prNumber = pr.number;
        item.prTitle = pr.title;
        item.state = pr.state.toLowerCase() as any;
      }
    }
  }

  return {
    repoName: status.repoName,
    currentBranch: status.branch,
    items: Array.from(itemsMap.values()),
  };
}

/** Parse CI check runs rollup */
export function parseCiStatus(checkRuns: any[]): { ciStatus: CiStatus; ciSummary?: string } {
  if (!Array.isArray(checkRuns) || checkRuns.length === 0) {
    return { ciStatus: 'unknown' };
  }

  let failures = 0;
  let inProgress = 0;
  let total = checkRuns.length;

  for (const check of checkRuns) {
    const conclusion = (check.conclusion || '').toUpperCase();
    const status = (check.status || '').toUpperCase();

    if (conclusion === 'FAILURE' || conclusion === 'CANCELLED' || conclusion === 'TIMED_OUT') {
      failures++;
    } else if (status === 'IN_PROGRESS' || status === 'QUEUED') {
      inProgress++;
    }
  }

  if (failures > 0) {
    return {
      ciStatus: 'failure',
      ciSummary: `${failures}/${total} failing`,
    };
  }

  if (inProgress > 0) {
    return {
      ciStatus: 'pending',
      ciSummary: `${inProgress}/${total} running`,
    };
  }

  return {
    ciStatus: 'success',
    ciSummary: 'CI passed',
  };
}

/** Fetch Pull Requests for current repo using gh CLI */
export async function getPullRequests(cwd: string, timeoutMs = 15000): Promise<PullRequestItem[]> {
  const status = await getGitStatus(cwd, timeoutMs);
  if (!status.isGit) return [];

  const res = await exec(
    'gh',
    [
      'pr',
      'list',
      '--json',
      'number,title,headRefName,state,url,comments,additions,deletions,statusCheckRollup',
      '--limit',
      '15',
    ],
    cwd,
    timeoutMs,
  );

  if (res.code !== 0 || !res.stdout.trim()) {
    return [];
  }

  try {
    const raw = JSON.parse(res.stdout);
    if (!Array.isArray(raw)) return [];

    return raw.map((pr: any) => {
      const { ciStatus, ciSummary } = parseCiStatus(pr.statusCheckRollup || []);
      const commentsCount = Array.isArray(pr.comments) ? pr.comments.length : (pr.comments || 0);

      return {
        number: pr.number,
        title: pr.title || '',
        branch: pr.headRefName || '',
        state: pr.state || 'OPEN',
        url: pr.url || '',
        commentsCount,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        ciStatus,
        ciSummary,
        repo: status.repoName,
      };
    });
  } catch {
    return [];
  }
}

/** Ensure .dsh directory is excluded in git so worktrees do not dirty working tree */
async function ensureDshExcluded(repoRoot: string): Promise<void> {
  try {
    const excludeFile = join(repoRoot, '.git', 'info', 'exclude');
    let content = '';
    try {
      content = await readFile(excludeFile, 'utf8');
    } catch {
      // file might not exist yet
    }
    if (!content.includes('.dsh')) {
      await mkdir(join(repoRoot, '.git', 'info'), { recursive: true });
      await appendFile(excludeFile, '\n.dsh\n.dsh/\n');
    }
  } catch {
    // Non-fatal if info/exclude cannot be written
  }
}

/** Create a new Git worktree */
export async function createWorktree(
  cwd: string,
  options: {
    baseBranch?: string;
    newBranch?: string;
    name?: string;
    prefix?: string;
  } = {},
  timeoutMs = 15000,
): Promise<CreateWorktreeResult> {
  const status = await getGitStatus(cwd, timeoutMs);
  if (!status.isGit || !status.root) {
    return { ok: false, worktreePath: '', branch: '', error: 'Not a git repository' };
  }

  const prefix = options.prefix ?? 'wt-';
  const rawBranchName = options.newBranch || options.name || `${prefix}${Date.now().toString(36)}`;

  // Strict branch name validation: no leading dash, only alphanumeric, dots, underscores, dashes
  if (!rawBranchName || !/^(?!\-)[a-zA-Z0-9._\-]+$/.test(rawBranchName)) {
    return {
      ok: false,
      worktreePath: '',
      branch: '',
      error: `Invalid branch name "${rawBranchName}". Branch names must not start with "-" and may only contain alphanumeric characters, dots, underscores, and hyphens.`,
    };
  }

  const branchName = rawBranchName;
  const baseWorktreesDir = resolve(status.root, '.dsh', 'worktrees');
  const worktreeDir = resolve(baseWorktreesDir, branchName);

  // Assert path containment: worktreeDir must strictly reside within baseWorktreesDir
  if (!worktreeDir.startsWith(baseWorktreesDir + '/')) {
    return {
      ok: false,
      worktreePath: '',
      branch: '',
      error: 'Path traversal detected: worktree directory must stay inside .dsh/worktrees',
    };
  }

  await ensureDshExcluded(status.root);
  await mkdir(baseWorktreesDir, { recursive: true });

  const args = ['worktree', 'add'];
  if (options.baseBranch) {
    // Verify baseBranch is a safe ref
    if (!/^(?!\-)[a-zA-Z0-9._\-/]+$/.test(options.baseBranch)) {
      return { ok: false, worktreePath: '', branch: '', error: 'Invalid base branch name' };
    }
    args.push('-b', branchName, worktreeDir, options.baseBranch);
  } else {
    args.push('-b', branchName, worktreeDir);
  }

  const res = await exec('git', args, cwd, timeoutMs);
  if (res.code !== 0) {
    // If branch already exists, try adding worktree checking out existing branch
    const fallback = await exec('git', ['worktree', 'add', worktreeDir, branchName], cwd, timeoutMs);
    if (fallback.code !== 0) {
      return {
        ok: false,
        worktreePath: '',
        branch: branchName,
        error: fallback.stderr.trim() || res.stderr.trim() || fallback.failed || res.failed,
      };
    }
  }

  return {
    ok: true,
    worktreePath: worktreeDir,
    branch: branchName,
  };
}

/** Switch branch or checkout */
export async function switchBranch(
  cwd: string,
  branch: string,
  timeoutMs = 15000,
): Promise<SwitchBranchResult> {
  const trimmed = (branch || '').trim();

  // Strict branch name validation: reject options, path traversals, special characters
  if (!trimmed || !/^(?!\-)[a-zA-Z0-9._\-/]+$/.test(trimmed) || trimmed.includes('..') || trimmed.includes('@{')) {
    return {
      ok: false,
      branch: trimmed,
      error: `Invalid branch name: "${trimmed}". Must not start with "-" and cannot contain traversal characters.`,
    };
  }

  // Verify ref format using Git's native validator
  const refFormatCheck = await exec('git', ['check-ref-format', '--branch', trimmed], cwd, timeoutMs);
  if (refFormatCheck.code !== 0) {
    return {
      ok: false,
      branch: trimmed,
      error: `Invalid git branch ref format: "${trimmed}"`,
    };
  }

  // Use '--' to ensure git interprets the argument strictly as a ref/branch and never as a path or option
  const res = await exec('git', ['checkout', trimmed, '--'], cwd, timeoutMs);
  if (res.code !== 0) {
    return {
      ok: false,
      branch: trimmed,
      error: res.stderr.trim() || res.failed || `Failed to switch to branch ${trimmed}`,
    };
  }

  return {
    ok: true,
    branch: trimmed,
  };
}
