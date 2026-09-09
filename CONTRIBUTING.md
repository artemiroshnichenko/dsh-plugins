# Contributing to DeepSeek Harness Plugins

Thank you for your interest in contributing to `dsh-plugins`! We welcome contributions, bug fixes, new plugins, and documentation improvements.

## Development Workflow

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Getting Started

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/artemiroshnichenko/dsh-plugins.git
   cd dsh-plugins
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build all packages:
   ```bash
   pnpm build
   ```

4. Run tests:
   ```bash
   pnpm test
   ```

## Adding a New Plugin

When proposing or adding a new plugin to `packages/`:

1. Follow the naming convention `dsh-<feature>`.
2. Configure `package.json` with appropriate `peerDependencies` (`@deepseek-ai/cordis`, etc.).
3. Define configuration parameters using `@deepseek-ai/schemastery` schemas.
4. Implement plugins with strict TypeScript (`strict: true`, no implicit `any`).
5. Include a comprehensive test suite in `tests/` using Vitest.
6. Provide a clean `README.md` detailing installation and configuration examples.

## Submitting a Pull Request

- Ensure all existing and new tests pass (`pnpm test`).
- Ensure the project builds without errors (`pnpm build`).
- Verify types without emitting (`pnpm typecheck`).
- Write descriptive, conventional commit messages (`feat: ...`, `fix: ...`, `docs: ...`).
