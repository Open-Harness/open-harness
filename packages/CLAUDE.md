# Open Harness Packages

This directory contains all Open Harness packages organized by category.

## Package Structure

### Internal (`internal/`)
Private implementation packages used by published packages:
- **`core/`** - Runtime, state, nodes, bindings, persistence interfaces, shared transport types
- **`server/`** - Hono API routes, providers (Anthropic), server transports, harness utilities
- **`client/`** - Client transports (HTTP/SSE client, remote transport)

### Published (`open-harness/`)
Packages intended to be published to npm:
- **`core/`** - Public core API (re-exports from `@internal/core`)
- **`server/`** - Public server API (re-exports from `@internal/server`)
- **`client/`** - Public client API (re-exports from `@internal/client`)
- **`react/`** - React hooks integrating with `@open-harness/client`
- **`testing/`** - Shared test utilities for Open Harness packages

### Adapters (`adapters/`)
Optional implementations that depend on `@open-harness/core` interfaces:
- **`run-store/sqlite/`** - SQLite `RunStore` implementation
- **`run-store/testing/`** - `RunStore` contract tests/utilities

## Package Dependencies

- Published packages are under `packages/open-harness/*` and use `@internal/*` implementation packages.
- Adapters implement interfaces from `@open-harness/core` (e.g. `RunStore`) and may use adapter-specific test utilities.
- `@internal/*` packages are private (not published).

## Development

Each package has its own:
- `package.json` with workspace dependencies
- `tsconfig.json` for TypeScript configuration
- `CLAUDE.md` with package-specific context
- Tests in `tests/` directory

Run quality checks:
```bash
bun run typecheck  # Type checking
bun run lint       # Linting
bun run test       # Tests
```
