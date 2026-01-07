---
title: "Open Harness Packages"
lastUpdated: "2026-01-07T10:33:43.219Z"
lastCommit: "7dd3f50eceaf866d8379e1c40b63b5321da7313f"
lastCommitDate: "2026-01-07T10:32:30Z"
scope:
  - architecture
  - documentation
  - monorepo-structure
---

# Open Harness Packages

This directory contains the core Open Harness monorepo organized by internal and public packages.

## Package Organization

### Internal Packages (`packages/internal/`)

Internal packages form the core architecture of Open Harness. They are not published to npm but are used across all applications and SDKs.

#### **`@internal/core`** — Runtime Execution Engine
- **Purpose**: Flow compilation, execution, scheduling, and state management
- **Location**: `packages/internal/core/src/`
- **Key Concerns**:
  - `runtime/` — Execution pipeline with 4 subsystems
    - `compiler/` — Flow definition validation and graph compilation
    - `execution/` — Node execution with retry/timeout logic
    - `expressions/` — JSONata evaluation for bindings and conditions
    - `state/` — Snapshots and persistence contracts
  - `nodes/` — Node registry and definitions
  - `persistence/` — Run store contracts and in-memory implementations
- **Consumers**: All applications and SDKs depend on core

#### **`@internal/server`** — Server Runtime & HTTP API
- **Purpose**: HTTP API, WebSocket transport, provider integrations
- **Location**: `packages/internal/server/src/`
- **Key Concerns**:
  - `api/` — Hono HTTP endpoints (chat, events, commands)
  - `transports/` — Transport adapters (local, WebSocket)
  - `providers/` — AI provider integrations (Anthropic SDK)

#### **`@internal/client`** — Browser Client & SSE Transport
- **Purpose**: HTTP Server-Sent Events client, transport abstraction
- **Location**: `packages/internal/client/src/`
- **Key Concerns**:
  - `transports/` — HTTP-SSE client, remote transport adapter, error handling

### Public Packages (`packages/@open-harness/`)

Public packages are published to npm and provide stable APIs for end users.

#### **`@open-harness/core`** — Public Core API
- Re-exports and stabilizes `@internal/core`

#### **`@open-harness/server`** — Public Server API
- Re-exports and stabilizes `@open-harness/core` + `@internal/server`

#### **`@open-harness/client`** — Public Browser Client
- Re-exports and stabilizes `@open-harness/core` + `@internal/client`

#### **`@open-harness/react`** — React Hooks & Components
- Built on top of `@open-harness/client`

#### **`@open-harness/run-store-sqlite`** — SQLite Persistence
- Implements RunStore for durable run history

## Documentation Standards

Each package includes comprehensive documentation:

- **`README.md`** — Package overview (what it does, key concepts, usage examples)
- **YAML Frontmatter** — Metadata with timestamps and git information
- **`src/*/README.md`** — Module-level documentation for complex subsystems
- **JSDoc** — Inline documentation on all public exports

### Frontmatter Format

All READMEs include YAML frontmatter with:

```yaml
---
title: "Human-readable title"
lastUpdated: "2026-01-07T09:37:15.032Z"  # ISO 8601 with seconds
lastCommit: "d298dbb361550864ab20f8c8af1bfa5c62ec8737"  # Git commit hash
lastCommitDate: "2026-01-07T09:05:41Z"  # Commit date
scope:  # Tags describing package scope
  - tag-1
  - tag-2
---
```

Metadata is **automatically synced** on every commit via lefthook pre-commit hook (`scripts/update-readme-metadata.ts`).

## Architecture Overview

```
┌─────────────────────────────────────────┐
│  Applications (apps/)                   │
│  - Horizon Agent (TUI)                  │
│  - Docs Site (Next.js)                  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  Public Packages (@open-harness/*)     │
│  - Stable, versioned, published         │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  Internal Packages (@internal/*)        │
│  - Core, Server, Client                 │
│  - Tightly coupled, not published       │
└──────────────┬──────────────────────────┘
               │
        ┌──────┼──────┐
        │      │      │
    ┌───▼──┐ ┌─▼──┐ ┌─▼────┐
    │Core  │ │Srv │ │Client│
    │      │ │    │ │      │
    └──────┘ └────┘ └──────┘
```

## Development Workflow

### Testing & Validation

```bash
# Test all packages
bun run test

# Type check all packages
bun run typecheck

# Lint all packages
bun run lint

# Build for distribution
bun run build
```

### Adding a New Package

1. Create `packages/[scope]/[name]/`
2. Add `package.json` with workspace declaration
3. Create `src/index.ts` with exports
4. Add `README.md` with YAML frontmatter (see Frontmatter Format above)
5. Metadata will sync automatically on first commit

## Key Concepts

### Flow Definition
A declarative specification of nodes (tasks) connected by edges (control flow). See `@internal/core` for the data model.

### Node Registry
Maps node type names to node definitions (execution logic, input/output schemas). Users register custom nodes via the registry.

### Runtime
Executes a flow: compiles the graph, schedules nodes, handles retries/timeouts, emits events, and persists state.

### Transport
Network layer abstraction. Implementations: HTTP-SSE (browser), WebSocket (TUI), local (Node.js).

## See Also

- `packages/internal/core/src/runtime/README.md` — Runtime subsystem architecture
- `packages/internal/server/src/README.md` — Server package details
- `packages/internal/client/src/transports/README.md` — Transport layer details
