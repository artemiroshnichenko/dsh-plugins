# DeepSeek Harness Plugins

A curated collection of production-grade plugins for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness), extending the AI agent with security guardrails, interactive workspace tools, remote execution capabilities, and introspection utilities.

All plugins are written in strict TypeScript, validated with [Schemastery](https://github.com/deepseek-ai/schemastery) schemas, and built on the Cordis dependency injection framework and Typert RPC protocol.

---

## Plugin Directory

| Package | Category | Description | Web UI | Tests |
| :--- | :--- | :--- | :---: | :---: |
| [`dsh-guard`](./packages/dsh-guard) | **Security** | Monotonic tool interception, destructive command prevention, and approval gating | — | 13 |
| [`dsh-workbench`](./packages/dsh-workbench) | **Developer Experience** | File explorer, terminal emulator (xterm.js), and one-click code block execution |  | 11 |
| [`dsh-ssh`](./packages/dsh-ssh) | **Remote Execution** | Remote agent execution over SSH with ACP bridge and approval relay |  | 80 |
| [`dsh-console`](./packages/dsh-console) | **Observability** | Skills & MCP servers inspector panel with `/skills` and `/mcp` slash commands |  | 3 |
| [`dsh-env`](./packages/dsh-env) | **Prompting** | Dynamic environment variables (`today`, `platform`, `harness_version`) | — | 5 |

---

## Plugins Overview

### 1. `dsh-guard`
Enforces strict security boundaries on tools (`bash`, `write`, `edit`, etc.) before execution:
- **Instant Denials**: Blocks destructive operations (`rm -rf /`, `mkfs`, fork bombs, raw disk writes) synchronously via `ctx.tools.guard()`.
- **Approval Gating**: Intercepts potentially unsafe mutations (destructive git commands, system restarts, package publication) using Cordis `tools/pre-execute` waterfall hooks to prompt the user.
- **Path Isolation**: Confines writes to allowed directory trees and protects sensitive system files (`/etc`, `~/.ssh`).

### 2. `dsh-workbench`
Turns the DSH Web GUI into a full developer workbench:
- **File Explorer**: Browse project directories, inspect file contents, view git changes, and compare diffs.
- **Terminal Emulator**: Full-featured interactive terminal (PTY / xterm.js) embedded into the chat workspace.
- **Runnable Code Blocks**: Injects interactive "Run" buttons into code blocks in assistant responses for direct execution.
- **Path Confinement**: Ensures all file access remains strictly inside authorized roots, blocking path traversal and symlink escapes.

### 3. `dsh-ssh`
Run agents directly on remote servers while keeping the Web GUI and session logs on your workstation:
- **Agent Client Protocol (ACP)**: Connects via SSH stdio (`ssh <host> dsh --profile acp`) with bidirectional JSON-RPC.
- **Local Workspace Shadows**: Caches remote project roots under `~/.dsh/remote/<host>/` so workspace registry and sessions work seamlessly.
- **Approval Relay**: Forwards remote permission requests directly to your local browser approval interface.
- **Host Management**: Interactive host manager in the Web UI sidebar with directory browsing and connection latency probing.

### 4. `dsh-console`
Comprehensive inspection panel for the agent's capabilities:
- **Skills & MCP Panel**: Adds a dedicated section to Settings displaying all loaded skills and connected MCP servers.
- **Slash Commands**:
  - `/skills`: Lists available global and project skills with descriptions and invocation flags.
  - `/mcp`: Displays active MCP servers, transport types, and tool counts.
- **Privacy-Preserving**: Strips authorization headers and environment tokens from server inspect responses.

### 5. `dsh-env`
Supplies contextual variables to system prompt templates:
- **Dynamic Variables**: Interpolates `today`, `platform`, `os_version`, `harness_version`, and custom user-defined variables.
- **Reactivity**: Updates daily date boundaries and runtime facts automatically across sessions.

---

## Installation & Setup

### Adding Plugins to DSH

To enable any of these plugins in your DeepSeek Harness deployment, add them to `~/.dsh/cordis.patch.yml`:

```yaml
- insert:
    - id: guard
      name: dsh-guard
      config:
        blockSshMutations: true

    - id: workbench
      name: dsh-workbench

    - id: console
      name: dsh-console

    - id: env
      name: dsh-env

# For dsh-ssh (replaces local agent-loop with SSH router):
- delete:
    - id: agent-loop
- insert:
    - id: ssh
      name: dsh-ssh
      config:
        hosts:
          - name: staging
            ssh: ubuntu@staging.internal
            cwd: /home/ubuntu/app
```

---

## Monorepo Development

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Build & Test

```bash
# Install dependencies
pnpm install

# Build all packages (TypeScript compilation + client asset bundling)
pnpm build

# Run all test suites across the monorepo (112 tests)
pnpm test

# Typecheck without emitting
pnpm typecheck
```

---

## Contributing & PR to DeepSeek Harness

When submitting plugins or integrating them upstream into `deepseek-ai/deepseek-harness`:
1. Ensure all code compiles cleanly with `pnpm build`.
2. Ensure every package has accompanying Vitest unit tests under `packages/<name>/tests/`.
3. Verify that no personal paths, environment tokens, or machine-specific hostnames exist in the codebase.
4. Keep client-side extensions decoupled and bundle-free using standard DSH client loader patterns.

## License

MIT © Artem Miroshnichenko
