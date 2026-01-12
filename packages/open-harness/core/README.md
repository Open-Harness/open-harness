---
title: "@open-harness/core"
lastUpdated: "2026-01-11T10:45:35.208Z"
lastCommit: "7c119005269c88d906afffaea1ab3b283a07056f"
lastCommitDate: "2026-01-11T07:21:34Z"
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
import { createWorkflow, ClaudeHarness } from "@open-harness/core";

// Define your state type
interface MyState {
  input: string;
  analysis?: string;
}

// Create typed workflow factory
const { agent, runReactive } = createWorkflow<MyState>();

// Define agents with signal chaining
const analyzer = agent({
  prompt: "Analyze: {{ state.input }}",
  activateOn: ["workflow:start"],
  emits: ["analysis:complete"],
  updates: "analysis",
});

// Run the workflow
const result = await runReactive({
  agents: { analyzer },
  state: { input: "Hello, world!" },
  harness: new ClaudeHarness(),
});

console.log(result.state.analysis);
```

## Exports

This package re-exports from internal packages:

### Workflow API

```typescript
// Factory
import { createWorkflow } from "@open-harness/core";

// Execution
import { runReactive } from "@open-harness/core";

// Types
import type {
  WorkflowFactory,
  ReactiveAgentConfig,
  ReactiveWorkflowConfig,
  WorkflowResult,
  ActivationContext,
} from "@open-harness/core";
```

### Harnesses

```typescript
// Claude (Anthropic)
import { ClaudeHarness, type ClaudeHarnessConfig } from "@open-harness/core";

// OpenAI/Codex
import { CodexHarness, type CodexHarnessConfig } from "@open-harness/core";
```

### Signals

```typescript
// Core
import { createSignal, type Signal, type Harness } from "@open-harness/core";

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
  setDefaultHarness,
  setDefaultStore,
  setDefaultMode,
  resetDefaults,
} from "@open-harness/core";
```

## Core Concepts

### Signal-Based Architecture

Open Harness v0.3.0 uses signals for all agent coordination:

```
workflow:start → agent activates → emits signal → next agent → workflow:end
```

### Agent Definition

```typescript
const myAgent = agent({
  prompt: "Your prompt with {{ state.field }} templates",
  activateOn: ["workflow:start"],  // When to activate
  emits: ["my:complete"],          // What to emit on success
  updates: "field",                // State field to update
  when: (ctx) => ctx.state.ready,  // Guard condition
});
```

### Recording & Replay

```typescript
const store = new MemorySignalStore();

// Record
await runReactive({
  agents, state, harness,
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

The `createWorkflow<TState>()` factory ensures all agents share the same state type:

```typescript
const { agent, runReactive } = createWorkflow<MyState>();

// All agents get typed state access
const myAgent = agent({
  when: (ctx) => ctx.state.fieldName,  // Full autocomplete
});
```

## See Also

- `packages/README.md` — Architecture overview
- `packages/internal/core/src/api/README.md` — API implementation
- `packages/signals/README.md` — Signal infrastructure
- `examples/` — Working examples
