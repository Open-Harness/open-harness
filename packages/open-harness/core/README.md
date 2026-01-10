---
title: "@open-harness/core"
lastUpdated: "2026-01-10T09:45:31.811Z"
lastCommit: "a9e5f66d3940822fd2e20996fc38318fe0aede14"
lastCommitDate: "2026-01-10T05:58:49Z"
scope:
  - public-api
  - core
  - signals
---

# @open-harness/core

Public core API for Open Harness v0.3.0.

## Installation

```bash
bun add @open-harness/core
# or
npm install @open-harness/core
```

## Quick Start

```typescript
import { createHarness, ClaudeProvider } from "@open-harness/core";

// Define your state type
interface MyState {
  input: string;
  analysis?: string;
}

// Create typed harness factory
const { agent, runReactive } = createHarness<MyState>();

// Define agents with signal chaining
const analyzer = agent({
  prompt: "Analyze: {{ state.input }}",
  activateOn: ["harness:start"],
  emits: ["analysis:complete"],
  updates: "analysis",
});

// Run the workflow
const result = await runReactive({
  agents: { analyzer },
  state: { input: "Hello, world!" },
  provider: new ClaudeProvider(),
});

console.log(result.state.analysis);
```

## Exports

This package re-exports from internal packages:

### Harness API

```typescript
// Factory
import { createHarness } from "@open-harness/core";

// Execution
import { runReactive } from "@open-harness/core";

// Types
import type {
  HarnessFactory,
  ReactiveAgentConfig,
  ReactiveHarnessConfig,
  ReactiveHarnessResult,
  ActivationContext,
} from "@open-harness/core";
```

### Providers

```typescript
// Claude (Anthropic)
import { ClaudeProvider, type ClaudeProviderConfig } from "@open-harness/core";

// OpenAI/Codex
import { CodexProvider, type CodexProviderConfig } from "@open-harness/core";
```

### Signals

```typescript
// Core
import { createSignal, type Signal, type Provider } from "@open-harness/core";

// Bus
import { SignalBus, type ISignalBus, type SignalHandler } from "@open-harness/core";

// Storage
import { MemorySignalStore, type SignalStore, type Recording } from "@open-harness/core";

// Playback
import { Player, type PlayerState, type PlayerPosition } from "@open-harness/core";

// Patterns
import { matchesPattern, matchesAnyPattern, type SignalPattern } from "@open-harness/core";

// Snapshots
import { snapshot, snapshotAll, type Snapshot } from "@open-harness/core";

// Reporters
import {
  attachReporter,
  createConsoleReporter,
  createMetricsReporter,
  type SignalReporter,
} from "@open-harness/core";
```

### Utilities

```typescript
// Templates
import { expandTemplate, hasTemplateExpressions, extractPaths } from "@open-harness/core";

// Debug
import {
  getCausalityChain,
  getAgentSignals,
  buildSignalTree,
  formatSignalTree,
} from "@open-harness/core";

// Telemetry
import { createTelemetrySubscriber, createWideEvent } from "@open-harness/core";

// Defaults
import {
  setDefaultProvider,
  setDefaultStore,
  setDefaultMode,
  resetDefaults,
} from "@open-harness/core";
```

## Core Concepts

### Signal-Based Architecture

Open Harness v0.3.0 uses signals for all agent coordination:

```
harness:start → agent activates → emits signal → next agent → harness:complete
```

### Agent Definition

```typescript
const myAgent = agent({
  prompt: "Your prompt with {{ state.field }} templates",
  activateOn: ["harness:start"],  // When to activate
  emits: ["my:complete"],         // What to emit on success
  updates: "field",               // State field to update
  when: (ctx) => ctx.state.ready, // Guard condition
});
```

### Recording & Replay

```typescript
const store = new MemorySignalStore();

// Record
await runReactive({
  agents, state, provider,
  fixture: "my-test",
  mode: "record",
  store,
});

// Replay (no API calls)
await runReactive({
  agents, state,
  fixture: "my-test",
  mode: "replay",
  store,
});
```

## Type Safety

The `createHarness<TState>()` factory ensures all agents share the same state type:

```typescript
const { agent, runReactive } = createHarness<MyState>();

// All agents get typed state access
const myAgent = agent({
  when: (ctx) => ctx.state.fieldName,  // ✅ Full autocomplete
});
```

## See Also

- `packages/README.md` — Architecture overview
- `packages/internal/core/src/api/README.md` — API implementation
- `packages/signals/README.md` — Signal infrastructure
- `examples/` — Working examples
