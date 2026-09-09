# dsh-ssh

Remote sessions over SSH for [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness).

Runs the AI agent directly on remote hosts over SSH while keeping the Web GUI and session history local on your workstation.

## How It Works

- **Agent Client Protocol (ACP)**: Connects to the remote server over SSH stdio (`ssh host dsh --profile acp`), allowing bidirectional JSON-RPC communication.
- **Local Workspace Shadows**: Preserves Harness workspace indexing and session persistence locally under `~/.dsh/remote/<host>/<remote_path>` while file operations, tools, and subprocesses run directly on the remote machine.
- **Approval Relay**: When a remote tool requires permission, the request is forwarded to your local browser UI for approval before execution proceeds on the server.
- **Automatic Fallback**: If no remote target is active, sessions continue locally via standard Cordis `agent-loop`.

## Installation

```bash
dsh plugin add dsh-ssh
# or via pnpm in your ~/.dsh/profiles/<profile>
pnpm add dsh-ssh
```

## Configuration

In `~/.dsh/cordis.patch.yml`:

```yaml
# Disable standard agent-loop so dsh-ssh can route sessions
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
            port: 22
          - name: dev-server
            ssh: dev.lan
            cwd: ~/projects
```

You can also add, edit, or remove hosts directly in the Web GUI sidebar.

## License

MIT
