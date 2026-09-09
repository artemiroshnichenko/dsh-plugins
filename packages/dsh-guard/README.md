# dsh-guard

Security guard plugin for [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness).

DeepSeek Harness defaults to open filesystem access for read operations under `workspace-write`. `dsh-guard` provides an active policy layer that prevents credential exfiltration and intercepts destructive or external shell operations before they execute.

## Features

- **Monotonic Path Denials**: Intercepts `read`, `write`, `edit`, `glob`, and `grep` calls against sensitive directories and secret files (`~/.ssh`, `~/.aws`, `~/.kube/config`, `.env`, `.pem`, private keys, and credential stores).
- **Destructive Command Blocking**: Irreversibly blocks catastrophic shell commands (`rm -rf /`, `mkfs`, raw device writes, fork bombs).
- **User Approval Gates**: Automatically routes high-risk commands (`git push`, `git reset --hard`, `docker compose down`, `systemctl restart`, `sudo`, destructive database drops) through DSH's native interactive approval flow.
- **Strict Typing & Schemas**: Configured via Cordis and Schemastery with full YAML schema validation.

## Installation

Install into your DSH profile:

```bash
dsh plugin add dsh-guard
# or via pnpm in your ~/.dsh/profiles/<profile>
pnpm add dsh-guard
```

## Configuration

Add the plugin to your `~/.dsh/cordis.patch.yml`:

```yaml
- insert:
    - id: guard
      name: dsh-guard
      config:
        # Additional path patterns to restrict
        denyPaths:
          - "~/company-secrets/**"
          - "**/.vault-token"

        # Additional commands requiring user confirmation
        askCommands:
          - id: terraform-apply
            re: "\\bterraform\\s+apply\\b"
            reason: "infrastructure deployment via terraform apply"

        # Output warnings on intercepted actions
        logDecisions: true
```

## Default Policies

### Denied Paths
- SSH keys and config (`~/.ssh/**`, `**/id_rsa*`, `**/id_ed25519*`)
- Cloud & container credentials (`~/.aws/**`, `~/.kube/config`, `~/.docker/config.json`)
- Environment files and certificates (`**/.env*`, `**/*.pem`, `**/*.p12`, `**/*.pfx`)
- Package registries (`~/.npmrc`, `~/.pypirc`, `~/.netrc`, `~/.git-credentials`)
- Agent credentials (`~/.dsh/.credentials.yaml`, `~/.claude/.credentials.json`)

### Monotonically Blocked Commands
- Recursive deletion of system root
- Filesystem formatting (`mkfs`)
- Direct block device manipulation (`dd of=/dev/sd*`, `> /dev/*`)
- Fork bombs (`:(){ :|:& };:`)

### Approval-Gated Commands
- Remote shell mutations (`ssh <host> <destructive-cmd>`)
- Recursive deletions (`rm -rf`)
- Git history and state resets (`git push`, `git reset --hard`, `git clean`)
- Daemon lifecycle (`systemctl`, `launchctl`, `service`)
- Package publications (`npm publish`, `cargo publish`)
- System changes (`sudo`, `brew install`, `apt install`)

## License

MIT
