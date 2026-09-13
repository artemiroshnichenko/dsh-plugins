# dsh-git

DeepSeek Harness Git & Worktrees plugin — branch selection, worktree isolation, and GitHub PR / CI cards modeled after Claude Code's developer experience.

## Features

- **Context Chip `[ ⑂ branch | 🔲 worktree ]`**:
  Displays the active git branch alongside the workspace folder chip in the conversation hero row.
- **Dropdown Branch & Worktree Selector**:
  Clicking the branch chip opens a dropdown displaying:
  - Active branch (blue indicator)
  - Worktrees (tagged with `wt`)
  - Branches with open GitHub PRs (green branch icon + PR title/number)
  - Branches with merged GitHub PRs (purple branch icon)
  - Seamless branch checkout and worktree switching
- **Worktree Isolation Toggle**:
  Check `worktree` to automatically run new sessions inside an isolated git worktree (`.dsh/worktrees/wt-*`), preventing branch collisions and uncommitted workspace pollution.
- **PR Cards above Prompt Composer**:
  Displays floating PR status cards above the input bar with:
  - Status indicator (✓ passed, ⓧ failing, ⑂ merged)
  - PR number link to GitHub
  - Diff stats (`+3,849 -0`)
  - Comment count (`💬 2`)
  - CI status badge (`🔴 CI 2/3 failing` / `✓ CI passed`)
  - Dismiss button (`✕`)
  - Expandable `Show N more` stack

## Configuration

In `cordis.yml` or `cordis.patch.yml`:

```yaml
- insert:
    - id: git
      name: dsh-git
      config:
        ghEnabled: true           # Enable GitHub CLI PR and CI queries (default: true)
        gitTimeoutMs: 15000       # Subprocess timeout in milliseconds (default: 15000)
        autoWorktreePrefix: "wt-" # Prefix for auto-created worktree branches (default: "wt-")
```

## Architecture

- **Host (`src/index.ts`, `src/git.ts`)**:
  Publishes the `dshGit` RPC namespace via `TypertRemoteService`:
  - `status(sessionId?, root?)`: Checks git worktree status, current branch, clean state.
  - `branches(sessionId?, root?)`: Lists worktrees and branches decorated with GitHub PR metadata.
  - `pullRequests(sessionId?, root?)`: Queries GitHub CLI for PR numbers, additions, deletions, comments, and CI rollup checks.
  - `createWorktree(sessionId?, root?, branch?, newBranch?, name?)`: Creates worktree in `.dsh/worktrees/`.
  - `switchBranch(sessionId?, root?, branch?)`: Checks out branch or switches worktree.
- **Client (`src/client.js`)**:
  Loaded dynamically via `window.__ModuleLoader__.load`:
  - Injects `dsh-git-hero-chip` into `shell.overlay` portaled into the conversation hero row.
  - Injects `dsh-git-prs` into `conversation.input.dock` for PR notification cards above the prompt input.

## License

MIT
