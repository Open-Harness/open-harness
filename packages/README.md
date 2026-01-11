---
title: "Open Harness Packages"
lastUpdated: "2026-01-11T10:45:35.208Z"
lastCommit: "7c119005269c88d906afffaea1ab3b283a07056f"
lastCommitDate: "2026-01-11T07:21:34Z"
scope:
  - architecture
  - documentation
  - monorepo-structure
---

# Open Harness Packages

This directory contains the core Open Harness monorepo organized by internal and public packages.

## v0.3.0 Architecture

Open Harness v0.3.0 uses a **signal-based reactive architecture**:

```
┌─────────────────────────────────────────────┐
│           Application Layer                  │
│  (Horizon Agent, Examples, User Apps)        │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│        Public API (@open-harness/*)          │
│  createWorkflow() → agent() → runReactive()  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Signal Infrastructure              │
│  SignalBus │ Harnesses │ MemorySignalStore   │
└─────────────────────────────────────────────┘
```

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Signal** | Typed event with `source`, `type`, `payload`, `timestamp` |
| **SignalBus** | Central dispatcher that routes signals to subscribers |
| **Harness** | AI SDK wrapper (Claude, OpenAI/Codex) that emits/handles signals |
| **Agent** | Configured harness with `activateOn` triggers and `emits` outputs |
| **Workflow** | Factory for creating typed agents with shared state |

### Signal Flow

```
workflow:start → agent activates → harness:end → next agent → workflow:end
     │                                    │                         │
     └── activateOn: ["workflow:start"] ──┘                         │
                                          └── activateOn: ["X:complete"] ─┘
```

## Quick Start

```typescript
import { createWorkflow, ClaudeHarness } from "@open-harness/core";

// 1. Define your state type
interface MyState {
  input: string;
  analysis?: string;
}

// 2. Create a typed workflow
const { agent, runReactive } = createWorkflow<MyState>();

// 3. Define agents with signal chaining
const analyzer = agent({
  prompt: "Analyze: {{ state.input }}",
  activateOn: ["workflow:start"],
  emits: ["analysis:complete"],
  updates: (output, state) => ({ analysis: output.text }),
});

// 4. Run the workflow
const result = await runReactive({
  agents: { analyzer },
  state: { input: "Hello, world!" },
  harness: new ClaudeHarness(),
});

console.log(result.state.analysis);
```

## Package Organization

### Internal Packages (`packages/internal/`)

Internal packages form the core implementation. They are not published to npm.

#### **`@internal/core`** — Core API & Signal Infrastructure
- **Location**: `packages/internal/core/src/`
- **Key Exports**:
  - `api/` — `createWorkflow()`, `agent()`, `runReactive()`
  - `lib/` — Logger, utilities
  - `persistence/` — `RunStore` interface (optional persistence)
  - `state/` — State types

#### **`@internal/server`** — Server Runtime & HTTP API
- **Location**: `packages/internal/server/src/`
- **Key Exports**:
  - `api/` — Hono HTTP endpoints
  - `transports/` — WebSocket, SSE transports

#### **`@internal/client`** — Browser Client
- **Location**: `packages/internal/client/src/`
- **Key Exports**:
  - `transports/` — HTTP-SSE client, remote transport

### Signal Packages (`packages/signals/`)

Core signal infrastructure that powers the reactive system:

#### **`@internal/signals`** — Signal Dispatcher
- `SignalBus` — Central event routing
- `MemorySignalStore` — Recording/replay
- `Player` — VCR-style navigation
- Pattern matching, snapshots, reporters

#### **`@internal/signals-core`** — Signal Primitives
- `createSignal()` — Signal factory
- `Harness` interface
- Type definitions

### Harness Packages (`packages/adapters/harnesses/`)

#### **`@open-harness/claude`** — Claude Integration
- `ClaudeHarness` — Anthropic Claude via Agent SDK

#### **`@open-harness/openai`** — OpenAI Integration
- `CodexHarness` — OpenAI models

### Public Packages (`packages/open-harness/`)

Published to npm with stable APIs:

| Package | Description |
|---------|-------------|
| `@open-harness/core` | Public core API (re-exports internal + signals) |
| `@open-harness/server` | Server API |
| `@open-harness/client` | Browser client |
| `@open-harness/react` | React hooks |
| `@open-harness/stores` | Store aggregator |

### Store Packages (`packages/stores/`)

Optional persistence implementations:

| Package | Description |
|---------|-------------|
| `@open-harness/run-store-sqlite` | SQLite run persistence |
| `@open-harness/recording-store-file` | File-based recordings |
| `@open-harness/recording-store-sqlite` | SQLite recordings |

## Key APIs

### `createWorkflow<TState>()`

Creates a factory for typed agents:

```typescript
const { agent, runReactive } = createWorkflow<MyState>();
```

Returns:
- `agent(config)` — Create agents bound to the state type
- `runReactive(options)` — Execute workflows

### `agent(config)`

Define an agent with signal-based activation:

```typescript
const myAgent = agent({
  // Required
  prompt: "Your prompt with {{ state.field }} interpolation",
  activateOn: ["workflow:start"],  // When to activate
  emits: ["my:complete"],          // What signals to emit

  // Optional
  updates: (output, state) => ({ /* partial state */ }),
  harness: customHarness,
  guard: (state) => state.shouldRun,
  timeout: 30000,
});
```

### `runReactive(options)`

Execute a signal-based workflow:

```typescript
const result = await runReactive({
  agents: { analyzer, writer },
  state: initialState,
  harness: new ClaudeHarness(),

  // Optional recording
  fixture: "my-test",
  mode: "replay",
  store: new MemorySignalStore(),
});
```

Returns:
```typescript
{
  state: FinalState,
  signals: Signal[],
  metrics: { latencyMs, activations },
  output: string,
}
```

## Signal Types

### Built-in Signals

| Signal | Description |
|--------|-------------|
| `workflow:start` | Workflow started |
| `workflow:end` | Workflow finished |
| `harness:start` | Harness invocation started |
| `harness:end` | Harness finished (with output) |
| `harness:error` | Harness failed |

### Custom Signals

Agents emit custom signals via `emits`:

```typescript
const analyzer = agent({
  emits: ["analysis:complete"],  // Emits "analysis:complete" on success
});

const writer = agent({
  activateOn: ["analysis:complete"],  // Activates on that signal
});
```

## Recording & Replay

v0.3.0 uses signal-based recording:

```typescript
import { MemorySignalStore } from "@open-harness/core";

const store = new MemorySignalStore();

// Record
await runReactive({
  agents,
  state,
  harness,
  fixture: "my-test",
  mode: "record",
  store,
});

// Replay (no API calls)
await runReactive({
  agents,
  state,
  fixture: "my-test",
  mode: "replay",
  store,
});
```

## Development

```bash
# Test all packages
bun run test

# Type check
bun run typecheck

# Lint
bun run lint
```

## See Also

- `packages/signals/README.md` — Signal infrastructure details
- `packages/internal/core/src/api/README.md` — API implementation details
- `examples/` — Working examples (simple-reactive, trading-agent, speckit)
