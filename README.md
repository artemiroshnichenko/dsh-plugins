# DeepSeek Harness Plugins (DSH)

[![CI](https://github.com/artemiroshnichenko/dsh-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/artemiroshnichenko/dsh-plugins/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Compatible-059669)](https://github.com/deepseek-ai/deepseek-harness)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-122%20passed-22c55e)](#)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange)](https://pnpm.io/)

A curated collection of production-grade plugins and extensions for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness).

These plugins turn DeepSeek Harness into a full-featured AI development environment: run agents on remote servers over SSH, browse files and run commands in an integrated Web terminal, enforce security guardrails on tool execution, inspect MCP servers and skills, and dynamically inject environment variables into system prompts.

---

## Plugin Directory

| Package | Category | Description | Web GUI | Tests |
| :--- | :--- | :--- | :---: | :---: |
| [`dsh-guard`](./packages/dsh-guard) | **Security & Guardrails** | Monotonic tool interception, destructive command prevention, and approval gating | — | 13 passed |
| [`dsh-workbench`](./packages/dsh-workbench) | **Developer Tools** | File tree explorer, full terminal emulator (xterm.js), and one-click code runner | Yes | 11 passed |
| [`dsh-ssh`](./packages/dsh-ssh) | **Remote Execution** | Remote agent execution over SSH with ACP bridge and browser approval relay | Yes | 80 passed |
| [`dsh-console`](./packages/dsh-console) | **Observability** | Skills & MCP servers inspector panel with `/skills` and `/mcp` slash commands | Yes | 3 passed |
| [`dsh-env`](./packages/dsh-env) | **System Prompt** | Dynamic environment variables (`today`, `platform`, `harness_version`, etc.) | — | 5 passed |
| [`dsh-updater`](./packages/dsh-updater) | **Lifecycle & Updates** | Automated update detection, one-click Web GUI upgrades, and auto-restart | Yes | 10 passed |

---

## Featured Capabilities

### 🛡️ `dsh-guard` — Tool Guardrails & Security Policies
Protect your workstation and infrastructure against accidental destructive operations before tool execution:
- **Instant Denials (`ctx.tools.guard`)**: Synchronously rejects catastrophic commands (`rm -rf /`, raw disk writes `dd of=/dev/sd*`, `mkfs`, fork bombs) without consuming token rounds.
- **Human Approval Gating**: Intercepts dangerous operations (git force-pushes, branch deletions, server restarts, package publishing) and prompts for interactive user approval via Cordis `tools/pre-execute` waterfall hooks.
- **Filesystem Confinement**: Restricts write and edit tools strictly to permitted workspace boundaries, preventing traversal into sensitive directories (`/etc`, `~/.ssh`).

### 💻 `dsh-workbench` — File Explorer & Web Terminal
An integrated developer workbench embedded right into the DeepSeek Harness Web GUI:
- **Directory Tree**: Browse files, inspect contents, view modified files, and preview git diffs directly in the sidebar.
- **Terminal Emulator (xterm.js / PTY)**: A real, responsive terminal session running alongside your agent chat.
- **Runnable Code Blocks**: Adds an interactive "Run in Terminal" action button to markdown code blocks returned by the model.
- **Safe Traversal Checks**: Uses hardened path confinement logic to prevent directory traversal and symlink escapes.

### 🌐 `dsh-ssh` — Remote Agent Execution via ACP
Run DeepSeek Harness agents directly on remote staging, cloud VMs, or production hosts over SSH:
- **Agent Client Protocol (ACP)**: Connects to remote machines over SSH stdio (`ssh host dsh --profile acp`) with bidirectional JSON-RPC streaming.
- **Local Workspace Shadows**: Indexes and caches workspace mirrors under `~/.dsh/remote/<host>/`, allowing local session history, search, and context persistence while operations run remotely.
- **Approval Relay**: Transparently routes remote tool approval requests back to your workstation's local browser UI.
- **Web GUI Host Switcher**: Switch target servers on the fly from the chat header, browse remote folders, and probe ping latency.

### 🔍 `dsh-console` — Skills & MCP Server Inspector
Complete visibility into your agent's active tooling and runtime configuration:
- **Settings Panel**: Adds a dedicated "Skills & MCP" panel to the Web GUI settings.
- **Slash Commands**:
  - `/skills`: Lists all discovered workspace and global skills, instructions, and invocation arguments.
  - `/mcp`: Displays active Model Context Protocol (MCP) servers, client transports, and exposed tools.
- **Privacy-Safe**: Redacts authorization tokens, bearer headers, and environment secrets from inspection output.

### ⚙️ `dsh-env` — Dynamic Prompt Environment Variables
Inject real-time runtime facts into agent system prompt templates:
- **Built-in Variables**: Automatically maintains `today` (date boundary), `platform` (OS name/architecture), `os_version`, and `harness_version`.
- **Custom Variables**: Define key-value pairs in configuration to supply deployment-specific context.

### 🔄 `dsh-updater` — Update Manager & One-Click Upgrades
Keep DeepSeek Harness and all community plugins continuously updated right from the Web GUI:
- **Automatic Version Detection**: Queries the npm registry for new `@deepseek-ai/dsh` releases and monitors git remotes for plugin updates.
- **Web GUI Settings & Header Badge**: Adds an "Updates" settings page and an alert badge in the conversation header when a new version is published.
- **Automated Symlink Repair**: Automatically fixes virtual store symlinks when updating `@deepseek-ai/dsh` in pnpm workspaces.
- **Seamless Auto-Restart**: Restarts the server gracefully in the background while the browser UI automatically detects when it is back online and refreshes.
- **Slash Commands**: Use `/update` to inspect release versions or `/update now` to upgrade directly from chat.

---

## Installation & Usage

### Quick Setup

Add the desired plugins to your local `~/.dsh/cordis.patch.yml`:

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

    - id: updater
      name: dsh-updater

# To route sessions over SSH (replaces default local agent loop):
- delete:
    - id: agent-loop
- insert:
    - id: ssh
      name: dsh-ssh
      config:
        hosts:
          - name: staging
            ssh: ubuntu@staging.example.com
            cwd: /var/www/app
            port: 22
```

Restart your DeepSeek Harness server or reload your profile:

```bash
dsh web
```

---

## Architecture & Standards

All plugins in this repository follow DeepSeek Harness architectural standards:

- **Cordis DI Architecture**: Pure service, plugin, and effect registrations via `@deepseek-ai/cordis`.
- **Strict TypeScript**: Compiled with TypeScript 5.5+ in strict mode (`noImplicitAny`, strict null checks).
- **Runtime Schemas**: Validated at configuration boundaries using `@deepseek-ai/schemastery`.
- **Typert RPC Gateway**: Clean host-to-client remote procedure calls using `@deepseek-ai/dsh-typert-protocol`.
- **Comprehensive Unit Testing**: 112 unit tests powered by Vitest, running against real fixtures without mocking network boundaries.

---

## Monorepo Development

```bash
# Clone the repository
git clone https://github.com/artemiroshnichenko/dsh-plugins.git
cd dsh-plugins

# Install workspace dependencies
pnpm install

# Build all packages and Web client bundles
pnpm build

# Run unit tests across all packages
pnpm test

# Typecheck the entire codebase
pnpm typecheck
```

---

## Frequently Asked Questions (FAQ)

<details>
<summary><b>Can I use dsh-ssh with password authentication?</b></summary>
We strongly recommend configuring SSH key authentication or an SSH agent (`ssh-add`) so that DSH can spawn non-interactive background SSH sessions without blocking on terminal password prompts.
</details>

<details>
<summary><b>Does dsh-guard slow down tool execution?</b></summary>
No. Static security rules and pattern inspections run synchronously in sub-millisecond time before commands are dispatched to the shell.
</details>

<details>
<summary><b>How does dsh-workbench isolate file operations?</b></summary>
All file access is validated against real canonical paths (`fs.realpath`) to ensure operations cannot escape authorized project roots via symlinks or <code>..</code> paths.
</details>

---

## Contributing

Contributions, feature requests, and issue reports are welcome! Please check out [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## License

[MIT](./LICENSE) © 2026 Artem Miroshnichenko
