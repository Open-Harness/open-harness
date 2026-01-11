---
title: "Workflow API"
lastUpdated: "2026-01-11T10:45:35.208Z"
lastCommit: "7c119005269c88d906afffaea1ab3b283a07056f"
lastCommitDate: "2026-01-11T07:21:34Z"
scope:
  - api
  - workflow
  - reactive
  - agents
---

# Workflow API

Core API for Open Harness v0.3.0 reactive agent system.

## What's here

| Module | Description |
|--------|-------------|
| `create-workflow.ts` | `createWorkflow<TState>()` factory |
| `agent.ts` | `agent()` definition builder |
| `run-reactive.ts` | `runReactive()` execution engine |
| `template.ts` | `{{ state.field }}` interpolation |
| `reactive-store.ts` | State change subscriptions |
| `debug.ts` | Causality chain analysis |
| `telemetry.ts` | Wide event collection |
| `defaults.ts` | Global default configuration |
| `types.ts` | Type definitions |

## createWorkflow<TState>()

Factory that creates typed agent builders and runner.

**Why a factory?** TypeScript variance. Without it, agents with `when` guards have contravariant state types that don't compose. The factory scopes all agents to a single state type.

```typescript
import { createWorkflow, ClaudeHarness } from "@open-harness/core";

interface TradingState {
  confidence: number;
  position: "long" | "short" | null;
  balance: number;
}

// Create typed factory
const { agent, runReactive } = createWorkflow<TradingState>();

// All agents share the state type
const analyst = agent({
  prompt: "Analyze market data",
  activateOn: ["workflow:start"],
  emits: ["analysis:complete"],
  when: (ctx) => ctx.state.balance > 1000,  // Fully typed!
});

const executor = agent({
  prompt: "Execute trades based on: {{ state.confidence }}",
  activateOn: ["analysis:complete"],
  emits: ["trade:executed"],
  when: (ctx) => ctx.state.confidence > 0.8,  // Autocomplete works!
});

// Run with typed initial state
const result = await runReactive({
  agents: { analyst, executor },
  state: { confidence: 0, position: null, balance: 5000 },
  harness: new ClaudeHarness(),
});
```

### Factory Returns

```typescript
type WorkflowFactory<TState> = {
  agent: <TOutput>(config: ReactiveAgentConfig<TOutput, TState>) => ScopedReactiveAgent;
  runReactive: (config: ReactiveWorkflowConfig<TState>) => Promise<WorkflowResult<TState>>;
};
```

## Agent Configuration

### Required Fields

```typescript
const myAgent = agent({
  prompt: "Your system prompt",
  activateOn: ["workflow:start"],  // Signal patterns to trigger on
});
```

### Optional Fields

```typescript
const myAgent = agent({
  prompt: "Analyze: {{ state.input }}",
  activateOn: ["workflow:start"],

  // Signal to emit on completion
  emits: ["analysis:complete"],

  // Guard condition
  when: (ctx) => ctx.state.ready && !ctx.state.done,

  // Update state field with output
  updates: "analysis",  // state.analysis = output.text

  // Per-agent harness override
  harness: customHarness,

  // Output schema (Zod)
  output: {
    schema: z.object({ sentiment: z.string() }),
  },
});
```

### Signal Patterns

`activateOn` accepts glob-style patterns:

| Pattern | Matches |
|---------|---------|
| `workflow:start` | Exact match |
| `harness:*` | `harness:start`, `harness:end` |
| `node:*:completed` | `node:writer:completed`, `node:analyzer:completed` |
| `**:error` | Any signal ending in `:error` |

### When Guards

Guards receive typed activation context:

```typescript
type ActivationContext<TState> = {
  signal: Signal;           // The triggering signal
  state: Readonly<TState>;  // Current state (typed!)
  input: unknown;           // Original input
};

const myAgent = agent({
  when: (ctx) => {
    // Full TypeScript support
    if (ctx.state.balance < 100) return false;
    if (ctx.signal.type === "error:critical") return false;
    return true;
  },
});
```

### State Updates

Two patterns for updating state:

```typescript
// Simple: assign output to field
const greeter = agent({
  updates: "greeting",  // state.greeting = output.text
});

// Complex: use reducers in runReactive
const result = await runReactive({
  agents: { analyzer },
  state: initialState,
  reducers: {
    "analysis:complete": (state, signal) => {
      state.analysis = signal.payload.output;
      state.lastAnalyzed = Date.now();
    },
  },
});
```

## runReactive()

Execute a signal-based workflow.

### Basic Usage

```typescript
const result = await runReactive({
  agents: { analyst, executor },
  state: { confidence: 0, position: null },
  harness: new ClaudeHarness(),
});

console.log(result.state);    // Final state
console.log(result.signals);  // All signals
console.log(result.metrics);  // { durationMs, activations }
```

### Full Configuration

```typescript
const result = await runReactive({
  // Required
  agents: { analyst, executor },
  state: initialState,

  // Harness
  harness: new ClaudeHarness(),

  // Termination
  endWhen: (state) => state.position !== null,
  timeout: 60000,  // TimeoutError if exceeded

  // Cancellation
  signal: abortController.signal,

  // Recording
  recording: {
    mode: "record",
    store: new MemorySignalStore(),
    name: "my-test",
  },

  // State reducers
  reducers: {
    "trade:executed": (state, signal) => {
      state.position = signal.payload.direction;
    },
  },
});
```

### Result Type

```typescript
type WorkflowResult<TState> = {
  state: TState;                    // Final state
  signals: readonly Signal[];       // All signals emitted
  metrics: {
    durationMs: number;
    activations: number;
  };
  terminatedEarly: boolean;         // endWhen triggered
  recordingId?: string;             // For replay
};
```

## Recording & Replay

### Record Mode

```typescript
const store = new MemorySignalStore();

const result = await runReactive({
  agents,
  state,
  harness: new ClaudeHarness(),
  recording: {
    mode: "record",
    store,
    name: "my-test",
  },
});

// result.recordingId can be used for replay
```

### Replay Mode

```typescript
const result = await runReactive({
  agents,
  state,
  recording: {
    mode: "replay",
    store,
    name: "my-test",
  },
});

// No API calls made - signals injected from recording
```

### Shorthand (fixture/mode/store)

```typescript
// Equivalent shorthand
const result = await runReactive({
  agents,
  state,
  harness: new ClaudeHarness(),
  fixture: "my-test",
  mode: "record",
  store: new MemorySignalStore(),
});
```

## Template Engine

Prompts support `{{ expression }}` interpolation:

```typescript
const writer = agent({
  prompt: `Write about {{ state.topic }}.

Previous analysis: {{ state.analysis }}

Requirements:
{{ state.requirements }}`,
  activateOn: ["analysis:complete"],
});
```

### Available Context

- `state.*` — Current workflow state
- `input.*` — Original input to runReactive
- `signal.*` — Triggering signal

### Functions

```typescript
import { expandTemplate, hasTemplateExpressions, extractPaths } from "@open-harness/core";

// Check if string has templates
hasTemplateExpressions("{{ state.x }}");  // true

// Expand templates
const expanded = expandTemplate("Hello {{ state.name }}", {
  state: { name: "World" },
});

// Extract referenced paths
const paths = extractPaths("{{ state.x }} and {{ state.y }}");
// ["state.x", "state.y"]
```

## Debug Utilities

Analyze signal causality chains:

```typescript
import {
  getCausalityChain,
  getAgentSignals,
  buildSignalTree,
  formatSignalTree,
  getSignalSummary,
} from "@open-harness/core";

// Get chain of signals leading to a target
const chain = getCausalityChain(signals, targetSignal);

// Get all signals from a specific agent
const agentSignals = getAgentSignals(signals, "analyst");

// Build tree structure
const tree = buildSignalTree(signals);
console.log(formatSignalTree(tree));

// Summary statistics
const summary = getSignalSummary(signals);
// { total: 10, byType: { "workflow:start": 1, ... }, ... }
```

## Telemetry

Wide event collection for observability:

```typescript
import { createTelemetrySubscriber, createWideEvent } from "@open-harness/core";

// Create telemetry subscriber
const telemetry = createTelemetrySubscriber({
  serviceName: "my-service",
  onEvent: (event) => {
    // Send to your observability platform
    sendToDatadog(event);
  },
});

// Attach to run
const result = await runReactive({
  agents,
  state,
  // telemetry subscriber automatically attached
});
```

### Wide Event Structure

```typescript
interface WorkflowWideEvent {
  service: string;
  timestamp: number;
  outcome: "success" | "error" | "timeout";
  durationMs: number;
  agentCount: number;
  activationCount: number;
  tokenUsage: TokenUsage;
  cost: CostBreakdown;
  signals: Signal[];
}
```

## Global Defaults

Set defaults to avoid repetition:

```typescript
import {
  setDefaultHarness,
  setDefaultStore,
  setDefaultMode,
  getDefaultHarness,
  resetDefaults,
} from "@open-harness/core";

// Set defaults
setDefaultHarness(new ClaudeHarness());
setDefaultStore(new MemorySignalStore());
setDefaultMode("replay");

// Use in runs (harness not needed if default set)
await runReactive({
  agents,
  state,
  fixture: "my-test",
  // harness, store, mode inherited from defaults
});

// Reset all defaults
resetDefaults();
```

## Error Handling

### TimeoutError

```typescript
import { TimeoutError } from "@open-harness/core";

try {
  await runReactive({
    agents,
    state,
    timeout: 5000,
  });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log(`Timeout after ${error.timeoutMs}ms`);
  }
}
```

### AbortSignal

```typescript
const controller = new AbortController();

// Cancel after 10s
setTimeout(() => controller.abort(), 10000);

const result = await runReactive({
  agents,
  state,
  signal: controller.signal,
});
```

## See Also

- `packages/README.md` — Architecture overview
- `packages/signals/README.md` — Signal infrastructure
- `examples/` — Working examples
