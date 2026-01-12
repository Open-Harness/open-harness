# @open-harness/core

**TypeScript-native agent framework. Signals. Recording. Evals.**

```typescript
const analyst = agent({
  prompt: "Analyze {{ state.symbol }}",
  activateOn: ["workflow:start"],
  when: (ctx) => ctx.state.ready,
  emits: ["analysis:complete"],
});

const trader = agent({
  prompt: "Trade based on {{ signal.payload.output }}",
  activateOn: ["analysis:complete"],
  when: (ctx) => ctx.state.analysis?.confidence > 0.8,
});

await runReactive({
  agents: { analyst, trader },
  state: { symbol: "AAPL", analysis: null },
  harness: new ClaudeHarness(),
});
```

Two agents. Signal-based coordination. Typed guards. 15 lines.

---

## Install

```bash
bun add @open-harness/core
# or
npm install @open-harness/core
```

---

## What You Get

### Test the execution, not just the output

```typescript
import { expect } from "vitest";
import "@open-harness/vitest";

expect(result.signals).toHaveSignalsInOrder([
  "workflow:start",
  "analysis:complete",
  "trade:proposed",
]);

expect(result.signals).toHaveSignalCount("agent:activated", 2);
expect(result).toCostUnder(0.05);
expect(result).toHaveLatencyUnder(5000);
```

Built on Vitest. Assert on signal flow, cost, and latency.

### Record once, replay forever

```typescript
// Record live execution
await runReactive({
  agents,
  state,
  fixture: "my-workflow",
  mode: "record",
  store,
});

// Replay in CI (zero API calls)
await runReactive({
  agents,
  state,
  fixture: "my-workflow",
  mode: "replay",
  store,
});
```

Your agent tests run in milliseconds.

### Swap providers without rewriting

```typescript
// Claude
const result = await runReactive({
  agents,
  state,
  harness: new ClaudeHarness(),
});

// OpenAI - one line change
const result = await runReactive({
  agents,
  state,
  harness: new CodexHarness(),
});
```

Same agents. Different model.

---

## Quick Start

```typescript
import { createWorkflow, ClaudeHarness } from "@open-harness/core";

// Define your state
interface MyState {
  name: string;
  greeting: string | null;
}

// Create typed workflow
const { agent, runReactive } = createWorkflow<MyState>();

// Define an agent
const greeter = agent({
  prompt: "Create a greeting for {{ state.name }}",
  activateOn: ["workflow:start"],
  updates: "greeting",
});

// Run it
const result = await runReactive({
  agents: { greeter },
  state: { name: "World", greeting: null },
  harness: new ClaudeHarness(),
  endWhen: (state) => state.greeting !== null,
});

console.log(result.state.greeting);
```

---

## Core Concepts

### Signals, not spaghetti

Agents subscribe to signal patterns. No imperative chains.

```typescript
const myAgent = agent({
  prompt: "Your prompt with {{ state.field }} templates",
  activateOn: ["workflow:start"],  // When to activate
  emits: ["my:complete"],          // What to emit on success
  updates: "field",                // State field to update
  when: (ctx) => ctx.state.ready,  // Guard condition
});
```

### Signal flow

```
workflow:start → agent activates → emits signal → next agent → workflow:end
```

Every step is observable. Every step is testable.

---

## Packages

| Package | Purpose |
|---------|---------|
| `@open-harness/core` | Workflow API, harnesses, signals |
| `@open-harness/vitest` | Vitest matchers for testing |
| `@open-harness/testing` | Test utilities |
| `@open-harness/stores` | Persistence (SQLite, file) |
| `@open-harness/server` | Server-side streaming |
| `@open-harness/client` | Client transports |
| `@open-harness/react` | React hooks |

---

## Why This Exists

We got tired of:
- Testing agents by eyeballing output
- Hitting APIs on every test run
- Rewriting when providers change
- Multi-agent code nobody can follow

So we built the framework we wanted to use.

---

[GitHub](https://github.com/Open-Harness/open-harness) · [Docs](https://open-harness.dev) · [Discord](https://discord.gg/openharness)
