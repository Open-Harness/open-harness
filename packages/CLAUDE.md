---
lastUpdated: "2026-01-11T06:45:24.116Z"
lastCommit: "ab7f25696b6e4667745177ceb2b8078657bcfd3a"
lastCommitDate: "2026-01-11T06:42:52Z"
---
# Open Harness Packages

This directory contains all Open Harness packages organized by category.

## Package Structure

### Adapters (`adapters/`)
Optional integrations for external services:
- **`providers/claude/`** - `@open-harness/provider-claude` - Anthropic Claude models
- **`providers/openai/`** - `@open-harness/provider-openai` - OpenAI Codex models

### Internal (`internal/`)
Private implementation packages used by published packages:
- **`core/`** - `@internal/core` - Runtime, state, harness, bindings, telemetry
- **`server/`** - `@internal/server` - Hono API routes and middleware
- **`client/`** - `@internal/client` - Client transports (HTTP/SSE client, remote transport)
- **`signals/`** - `@internal/signals` - SignalBus, stores, reporters, snapshots
- **`signals-core/`** - `@internal/signals-core` - Signal primitives and Provider types

### Published (`open-harness/`)
Packages intended to be published to npm:
- **`core/`** - `@open-harness/core` - Public core API (re-exports from internal packages)
- **`server/`** - `@open-harness/server` - Public server API
- **`client/`** - `@open-harness/client` - Public client API
- **`react/`** - `@open-harness/react` - React hooks integrating with client
- **`stores/`** - `@open-harness/stores` - Persistence implementations (SQLite, file)
- **`testing/`** - `@open-harness/testing` - Shared test utilities
- **`vitest/`** - `@open-harness/vitest` - Vitest matchers for signal assertions

## Package Dependencies

```
@open-harness/core (public facade)
├── @internal/core
├── @internal/signals
├── @internal/signals-core
├── @open-harness/provider-claude
└── @open-harness/provider-openai
```

- Published packages are under `packages/open-harness/*` and re-export from `@internal/*`
- Provider adapters are under `packages/adapters/providers/*`
- `@internal/*` packages are private (not published)

## Development

Each package has its own:
- `package.json` with workspace dependencies
- `tsconfig.json` for TypeScript configuration
- `README.md` with package-specific documentation
- Tests in `tests/` directory

Run quality checks:
```bash
bun run typecheck  # Type checking
bun run lint       # Linting
bun run test       # Tests
```
