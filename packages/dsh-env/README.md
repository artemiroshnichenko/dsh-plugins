# dsh-env

Environment facts plugin for [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness).

DeepSeek Harness provides `model` and `cwd` as prompt variables. `dsh-env` enriches the system prompt with deterministic system facts: today's calendar date, the operating system platform and architecture, OS kernel release, and the active DSH harness version. This saves the model from shelling out (`uname`, `date`, `node -v`) on routine questions.

## Features

- Injects `today`: Local date and day of week (e.g. `2026-09-09 (Wednesday)`), refreshed per prompt assembly.
- Injects `platform`: OS and CPU architecture (e.g. `macOS (arm64)`, `Linux (x64)`).
- Injects `os_version`: Kernel release info (e.g. `Darwin 25.6.0`).
- Injects `harness_version`: Current DSH version (e.g. `dsh 0.1.2-rc.1`).
- Custom variables: Define arbitrary static variables to expose in prompt templates.

## Installation

```bash
dsh plugin add dsh-env
# or via pnpm in your ~/.dsh/profiles/<profile>
pnpm add dsh-env
```

## Configuration

Add to your `~/.dsh/cordis.patch.yml`:

```yaml
- insert:
    - id: env
      name: dsh-env
      config:
        includeToday: true
        includePlatform: true
        includeOsVersion: true
        includeHarnessVersion: true
        customVariables:
          environment: production
```

## Usage in System Prompt Templates

Variables registered by `dsh-env` can be referenced directly in your persona templates:

```markdown
Today: {{today}}
Platform: {{platform}}
OS: {{os_version}}
Harness: {{harness_version}}
```

## License

MIT
