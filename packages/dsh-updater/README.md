# dsh-updater

DeepSeek Harness and community plugins update manager — update checks, one-click upgrades, and automated restarts from the Web GUI.

## Features

- **Automated Update Detection**: Checks official npm registry for `@deepseek-ai/dsh` and git repository for `dsh-plugins`.
- **Web GUI Settings Page**: Dedicated "Updates" section in Settings displaying current vs latest versions, release dates, and installed plugins.
- **Header Update Badge**: Shows a prominent notification chip in the conversation header when updates are available.
- **One-Click Upgrades**: Installs updates via pnpm, repairs profile symlinks, and rebuilds plugins in one click.
- **Seamless Auto-Restart**: Gracefully shuts down the old process, launches `mind`, and polls in the browser until the server returns, automatically refreshing the page.
- **Slash Commands**: `/update` to check status and `/update now` to upgrade directly from chat.

## Installation

Add to your `~/.dsh/cordis.patch.yml` or profile configuration:

```yaml
- insert:
    - id: updater
      name: dsh-updater
      config:
        autoCheckIntervalMinutes: 60
        enableBadge: true
        enableCommands: true
```

## Configuration

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `autoCheckIntervalMinutes` | `number` | `60` | Background update check interval in minutes |
| `enableBadge` | `boolean` | `true` | Show update notification badge in header |
| `enableCommands` | `boolean` | `true` | Register `/update` slash command |
| `dshInstallPath` | `string` | `"~/.agents/tools/dsh"` | Path to DSH installation directory |
| `pluginsRepoPath` | `string` | `"~/projects/dsh-plugins"` | Path to dsh-plugins monorepo |
| `profilesPath` | `string` | `"~/.dsh/profiles"` | Path to DSH profiles directory |
