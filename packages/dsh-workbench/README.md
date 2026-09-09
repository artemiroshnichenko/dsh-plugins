# dsh-workbench

Files and Terminal tabs for the [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) Web GUI.

DeepSeek Harness conversation view focuses on messages. `dsh-workbench` introduces full IDE capabilities directly inside the web interface: browse the workspace tree, inspect syntax-highlighted files, edit and save text files with conflict detection, inspect Git diffs, and execute shell commands inside a stateful terminal emulator.

## Features

- **Integrated Files Tab**: Browse workspace files with Git status badges (untracked, modified, staged, deleted, conflict).
- **In-Browser Text Editor**: Syntax highlighting, line numbers, and safe saving backed by modification timestamps to prevent overwriting concurrent changes.
- **Git Diffs**: Colorized unified diff viewer with branch indicators and staged/unstaged change inspection.
- **Persistent Terminal Tab**: Web-based terminal emulator retaining directory state (`cd`) across executions.
- **Runnable Code Blocks**: Adds an interactive "Run" button to shell code snippets in conversation messages for quick 1-click execution.
- **Security Confinement**: All file access strictly confined within the active session workspace root. Traversal and symlink escapes are prevented.

## Installation

```bash
dsh plugin add dsh-workbench
# or via pnpm in your ~/.dsh/profiles/<profile>
pnpm add dsh-workbench
```

## Configuration

Add the plugin to your `~/.dsh/cordis.patch.yml`:

```yaml
- insert:
    - id: workbench
      name: dsh-workbench
      config:
        # Maximum file size editable in browser (default: 2097152 bytes)
        maxReadBytes: 2097152

        # Maximum directory entries returned (default: 2000)
        maxEntries: 2000

        # Command timeout in milliseconds (default: 120000)
        shellTimeoutMs: 120000

        # Git operation timeout (default: 15000)
        gitTimeoutMs: 15000
```

## Architecture

- **Host Service (`dsh-workbench`)**: Exposes RPC endpoints under the `dshWorkbench` namespace via `TypertRemoteService`:
  - `list`: Directory contents with git status
  - `read`: Read file text and version stamp
  - `save`: Write file with optimistic concurrency validation
  - `changes`: Git porcelain status list
  - `diff`: Git unified diff
  - `run`: Shell execution with preserved `PWD`
  - `resetShell`: Reset remembered working directory
- **Client Plugin (`dsh-workbench/client`)**: Registers `Files` and `Terminal` tabs into `conversation.view` slots and observes conversation code blocks to inject the Run button.

## License

MIT
