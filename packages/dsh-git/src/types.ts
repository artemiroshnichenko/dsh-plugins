export interface GitConfig {
  /** Enable GitHub CLI queries for PR and CI status. Defaults to true. */
  ghEnabled?: boolean;
  /** Timeout in milliseconds for git/gh queries. Defaults to 15000. */
  gitTimeoutMs?: number;
  /** Prefix for automatically created worktree branches. Defaults to "wt-". */
  autoWorktreePrefix?: string;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  failed: string;
}

export interface GitStatusResult {
  isGit: boolean;
  root: string;
  repoName: string;
  branch: string;
  isWorktree: boolean;
  worktreePath?: string;
  clean?: boolean;
  error?: string;
}

export interface GitBranchItem {
  name: string;
  current: boolean;
  isWorktree: boolean;
  worktreePath?: string;
  state?: 'active' | 'open' | 'merged' | 'closed';
  prNumber?: number;
  prTitle?: string;
}

export type CiStatus = 'success' | 'failure' | 'pending' | 'unknown';

export interface PullRequestItem {
  number: number;
  title: string;
  repo: string;
  branch: string;
  state: 'OPEN' | 'MERGED' | 'CLOSED';
  additions: number;
  deletions: number;
  commentsCount: number;
  ciStatus: CiStatus;
  ciSummary?: string;
  url: string;
}

export interface CreateWorktreeRequest {
  cwd: string;
  branch?: string;
  newBranch?: string;
  name?: string;
}

export interface CreateWorktreeResult {
  ok: boolean;
  worktreePath: string;
  branch: string;
  error?: string;
}

export interface SwitchBranchRequest {
  cwd: string;
  branch: string;
}

export interface SwitchBranchResult {
  ok: boolean;
  branch: string;
  error?: string;
}
