# dsh-console

Skills and MCP console for [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness).

Provides full visibility into the agent's installed skills and connected Model Context Protocol (MCP) servers.

## Features

- **Settings Page**: Adds a "Skills & MCP" panel under Settings to browse, search, and inspect all loaded skills and active MCP servers.
- **Slash Commands**:
  - `/skills`: Lists all available global and project skills with their sources and descriptions.
  - `/mcp`: Shows all configured MCP servers, transport types, connection health, and exposed tool counts.
- **Privacy-Conscious**: Never exposes environment variables or headers from MCP server configurations in the UI.

## Installation

```bash
dsh plugin add dsh-console
# or via pnpm in your ~/.dsh/profiles/<profile>
pnpm add dsh-console
```

## Configuration

Add to your `~/.dsh/cordis.patch.yml`:

```yaml
- insert:
    - id: console
      name: dsh-console
      config:
        enableCommands: true
```

## License

MIT
