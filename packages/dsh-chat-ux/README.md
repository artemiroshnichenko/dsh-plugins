# dsh-chat-ux

DeepSeek Harness Chat UX enhancements — deduplicate repeating system prompts and smooth turn-by-turn history paging.

## Features

- **System Prompt Deduplication**: Automatically collapses and hides repeat system prompts across session history, displaying only the primary initial system prompt.
- **Turn-by-Turn History Paging**: Enhances "Load earlier" to continue loading chunks until an earlier user dialogue turn appears, skipping intermediate tool step bursts.

## Installation

Add to `~/.dsh/cordis.patch.yml` or your profile:

```yaml
- insert:
    - id: chat-ux
      name: dsh-chat-ux
      config:
        dedupSystemPrompts: true
        pageByTurn: true
```
