import { Context } from '@deepseek-ai/cordis';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, realpath, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  exec,
  getGitStatus,
  listBranchesAndWorktrees,
  parseCiStatus,
  createWorktree,
  switchBranch,
} from '../src/git.js';
import DshGit from '../src/index.js';

describe('dsh-git host helpers', () => {
  let tempDir: string;

  beforeEach(async () => {
    const raw = await mkdtemp(join(tmpdir(), 'dsh-git-test-'));
    tempDir = await realpath(raw);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reports isGit: false for non-git directories', async () => {
    const status = await getGitStatus(tempDir);
    expect(status.isGit).toBe(false);
    expect(status.branch).toBe('');
    expect(status.root).toBe('');
  });

  it('parses git status and branches for an initialized repo', async () => {
    await exec('git', ['init', '-b', 'main'], tempDir);
    await exec('git', ['config', 'user.name', 'Test'], tempDir);
    await exec('git', ['config', 'user.email', 'test@example.com'], tempDir);

    await writeFile(join(tempDir, 'README.md'), '# Test');
    await exec('git', ['add', '.'], tempDir);
    await exec('git', ['commit', '-m', 'Initial commit'], tempDir);

    const status = await getGitStatus(tempDir);
    expect(status.isGit).toBe(true);
    expect(status.branch).toBe('main');
    expect(status.isWorktree).toBe(false);
    expect(status.clean).toBe(true);

    // Create another branch
    await exec('git', ['branch', 'feature-1'], tempDir);

    const branches = await listBranchesAndWorktrees(tempDir, 15000, false);
    expect(branches.currentBranch).toBe('main');

    const mainItem = branches.items.find((b) => b.name === 'main');
    expect(mainItem).toBeDefined();
    expect(mainItem?.current).toBe(true);
    // Primary checkout must NEVER be marked as isWorktree: true
    expect(mainItem?.isWorktree).toBe(false);

    const featItem = branches.items.find((b) => b.name === 'feature-1');
    expect(featItem).toBeDefined();
    expect(featItem?.current).toBe(false);
    expect(featItem?.isWorktree).toBe(false);
  });

  it('creates and lists worktrees safely', async () => {
    await exec('git', ['init', '-b', 'main'], tempDir);
    await exec('git', ['config', 'user.name', 'Test'], tempDir);
    await exec('git', ['config', 'user.email', 'test@example.com'], tempDir);
    await writeFile(join(tempDir, 'file.txt'), 'hello');
    await exec('git', ['add', '.'], tempDir);
    await exec('git', ['commit', '-m', 'Init'], tempDir);

    const wtRes = await createWorktree(tempDir, { newBranch: 'wt-branch-1' });
    expect(wtRes.ok).toBe(true);
    expect(wtRes.branch).toBe('wt-branch-1');
    expect(wtRes.worktreePath).toContain('worktrees');

    // Verify .dsh is excluded in .git/info/exclude
    const excludeContent = await readFile(join(tempDir, '.git', 'info', 'exclude'), 'utf8');
    expect(excludeContent).toContain('.dsh');

    // Check status inside the created worktree
    const wtStatus = await getGitStatus(wtRes.worktreePath);
    expect(wtStatus.isGit).toBe(true);
    expect(wtStatus.branch).toBe('wt-branch-1');
    expect(wtStatus.isWorktree).toBe(true);

    // Verify it is listed as a linked worktree in the parent repo
    const listRes = await listBranchesAndWorktrees(tempDir, 15000, false);
    const wtItem = listRes.items.find((i) => i.name === 'wt-branch-1');
    expect(wtItem).toBeDefined();
    expect(wtItem?.isWorktree).toBe(true);
    expect(wtItem?.worktreePath).toBe(wtRes.worktreePath);

    // Main branch is still not a worktree
    const mainItem = listRes.items.find((i) => i.name === 'main');
    expect(mainItem?.isWorktree).toBe(false);
  }, 20000);

  it('prevents path traversal in worktree creation', async () => {
    await exec('git', ['init', '-b', 'main'], tempDir);
    await exec('git', ['config', 'user.name', 'Test'], tempDir);
    await exec('git', ['config', 'user.email', 'test@example.com'], tempDir);
    await writeFile(join(tempDir, 'file.txt'), 'hello');
    await exec('git', ['add', '.'], tempDir);
    await exec('git', ['commit', '-m', 'Init'], tempDir);

    const traversalRes = await createWorktree(tempDir, { newBranch: '../../escaped' });
    expect(traversalRes.ok).toBe(false);
    expect(traversalRes.error).toContain('Invalid branch name');
  });

  it('safely switches branches and rejects option injection', async () => {
    await exec('git', ['init', '-b', 'main'], tempDir);
    await exec('git', ['config', 'user.name', 'Test'], tempDir);
    await exec('git', ['config', 'user.email', 'test@example.com'], tempDir);
    await writeFile(join(tempDir, 'file.txt'), 'original content');
    await exec('git', ['add', '.'], tempDir);
    await exec('git', ['commit', '-m', 'Init'], tempDir);

    // Create feature branch
    await exec('git', ['branch', 'feat-x'], tempDir);

    // Modify file without committing
    await writeFile(join(tempDir, 'file.txt'), 'uncommitted changes');

    // Attempting option injection like "-f" must be blocked and rejected!
    const injectionRes = await switchBranch(tempDir, '-f');
    expect(injectionRes.ok).toBe(false);
    expect(injectionRes.error).toContain('Invalid branch name');

    // Verify uncommitted file was NOT discarded
    const fileContent = await readFile(join(tempDir, 'file.txt'), 'utf8');
    expect(fileContent).toBe('uncommitted changes');

    // Clean up uncommitted changes and switch cleanly to feat-x
    await exec('git', ['checkout', 'file.txt'], tempDir);
    const switchRes = await switchBranch(tempDir, 'feat-x');
    expect(switchRes.ok).toBe(true);
    expect(switchRes.branch).toBe('feat-x');

    const currentStatus = await getGitStatus(tempDir);
    expect(currentStatus.branch).toBe('feat-x');
  });

  describe('parseCiStatus', () => {
    it('handles empty checks array', () => {
      expect(parseCiStatus([])).toEqual({ ciStatus: 'unknown' });
    });

    it('identifies passing checks', () => {
      const checks = [
        { name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' },
        { name: 'lint', status: 'COMPLETED', conclusion: 'SUCCESS' },
      ];
      expect(parseCiStatus(checks)).toEqual({
        ciStatus: 'success',
        ciSummary: 'CI passed',
      });
    });

    it('identifies failing checks', () => {
      const checks = [
        { name: 'test', status: 'COMPLETED', conclusion: 'FAILURE' },
        { name: 'lint', status: 'COMPLETED', conclusion: 'SUCCESS' },
      ];
      expect(parseCiStatus(checks)).toEqual({
        ciStatus: 'failure',
        ciSummary: '1/2 failing',
      });
    });

    it('identifies pending checks', () => {
      const checks = [
        { name: 'test', status: 'IN_PROGRESS' },
        { name: 'lint', status: 'COMPLETED', conclusion: 'SUCCESS' },
      ];
      expect(parseCiStatus(checks)).toEqual({
        ciStatus: 'pending',
        ciSummary: '1/2 running',
      });
    });
  });

  describe('DshGit root authorization', () => {
    it('denies roots outside registered workspaces', async () => {
      const ctx = new Context();
      (ctx as any).sessions = { get: () => undefined };
      (ctx as any).workspaceRegistry = {
        list: () => [{ path: tempDir }],
      };

      const service = new DshGit(ctx);

      // Path inside registered workspace is allowed
      const allowed = await service.rootFor(undefined, tempDir);
      expect(allowed).toBe(tempDir);

      // Path outside registered workspace is rejected
      await expect(service.rootFor(undefined, '/etc/forbidden')).rejects.toThrow(
        'Access denied: path "/etc/forbidden" is not within registered workspaces',
      );
    });

    it('unpacks object arguments with { sessionId, root }', async () => {
      const ctx = new Context();
      (ctx as any).sessions = { get: () => undefined };
      (ctx as any).workspaceRegistry = {
        list: () => [{ path: tempDir }],
      };

      const service = new DshGit(ctx);
      const allowed = await service.rootFor({ root: tempDir });
      expect(allowed).toBe(tempDir);
    });

    it('resolves session workspace by sessionIds in registry', async () => {
      const ctx = new Context();
      (ctx as any).sessions = { get: () => undefined };
      (ctx as any).workspaceRegistry = {
        list: () => [{ path: tempDir, sessionIds: ['s-123'] }],
      };

      const service = new DshGit(ctx);
      const allowed = await service.rootFor('s-123');
      expect(allowed).toBe(tempDir);
    });

    it('does not leak arbitrary workspaces when neither root nor session is provided', async () => {
      const ctx = new Context();
      (ctx as any).sessions = { get: () => undefined };
      (ctx as any).workspaceRegistry = {
        list: () => [{ path: '/some/other/workspace' }],
      };

      const service = new DshGit(ctx);
      const res = await service.rootFor(undefined, undefined);
      // Must not be /some/other/workspace
      expect(res).not.toBe('/some/other/workspace');
    });
  });
});
