# F2: Basic Reactive Agent - Implementation Plan

**Epic:** F2 (Milestone 1: Agent Foundation)
**Status:** Planning
**Created:** 2026-01-09

---

## Overview

Extend the `agent()` function with reactive capabilities: `activateOn`, `emits`, `when`, and per-agent `provider`. Create `runReactive()` to execute a single reactive agent within a signal-driven environment.

### Target API

```typescript
import { agent, runReactive } from "@open-harness/core";
import { ClaudeProvider } from "@signals/provider-claude";

const analyst = agent({
  prompt: "Analyze the input: {{ input }}",

  // NEW: What signals trigger this agent
  activateOn: ["harness:start", "data:updated"],

  // NEW: What signals this agent produces
  emits: ["analysis:complete"],

  // NEW: Guard condition (only activate if true)
  when: (ctx) => ctx.input !== null,

  // NEW: Per-agent provider override
  provider: new ClaudeProvider(),
});

const result = await runReactive(analyst, { input: "market data" });

// Result contains all signals emitted during execution
expect(result.signals).toContainSignal("harness:start");
expect(result.signals).toContainSignal("agent:analyst:activated");
expect(result.signals).toContainSignal("analysis:complete");
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        runReactive()                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Create SignalBus                                            │
│  2. Subscribe agent based on activateOn patterns                │
│  3. Emit "harness:start" with input                             │
│  4. Wait for agent activation                                   │
│  5. Check "when" guard                                          │
│  6. Execute provider.run()                                      │
│  7. Emit provider signals to bus                                │
│  8. Emit declared "emits" signals                               │
│  9. Detect quiescence (no pending work)                         │
│  10. Return result with all signals                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SignalBus                                │
│  - Collects all signals                                         │
│  - Pattern-based subscriptions                                  │
│  - History for assertions                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Task 1: Extend AgentConfig Types

**File:** `packages/internal/core/src/api/types.ts`

Add new optional properties to `AgentConfig`:

```typescript
export type AgentConfig<TOutput = unknown, TState = Record<string, unknown>> = {
  prompt: string;
  state?: TState;
  output?: { schema?: ZodType<TOutput> };

  // NEW: Reactive properties

  /**
   * Signal patterns that trigger this agent.
   * Uses glob syntax: "harness:start", "state:*:changed", "trade:**"
   */
  activateOn?: SignalPattern[];

  /**
   * Signals this agent declares it will emit.
   * Declarative - helps with workflow visualization.
   */
  emits?: string[];

  /**
   * Guard condition - agent only activates if this returns true.
   * Receives the activation context (triggering signal + current state).
   */
  when?: (ctx: ActivationContext<TState>) => boolean;

  /**
   * Per-agent provider override.
   * If not set, uses default provider from runReactive options.
   */
  provider?: Provider;
};

/**
 * Context passed to "when" guard function.
 */
export type ActivationContext<TState = Record<string, unknown>> = {
  /** The signal that triggered this activation check */
  signal: Signal;
  /** Current state (input for single agent, harness state for multi-agent) */
  state: TState;
  /** Original input passed to runReactive */
  input: unknown;
};
```

**Import needed:** `Signal` from `@signals/core`, `SignalPattern` from `@signals/bus`

---

### Task 2: Create ReactiveAgent Type

**File:** `packages/internal/core/src/api/types.ts`

```typescript
/**
 * A reactive agent is an agent with activation rules.
 * Can be run in a reactive context via runReactive().
 */
export type ReactiveAgent<TOutput = unknown, TState = Record<string, unknown>> =
  Agent<TOutput, TState> & {
    /**
     * Indicates this agent has reactive capabilities.
     * Presence of activateOn makes an agent reactive.
     */
    readonly _reactive: true;
  };

/**
 * Type guard for reactive agents.
 */
export function isReactiveAgent(value: unknown): value is ReactiveAgent {
  return isAgent(value) && value.config.activateOn !== undefined;
}
```

---

### Task 3: Update agent() Factory

**File:** `packages/internal/core/src/api/agent.ts`

Update the factory to set `_reactive` flag when `activateOn` is present:

```typescript
export function agent<TOutput = unknown, TState = Record<string, unknown>>(
  config: AgentConfig<TOutput, TState>,
): Agent<TOutput, TState> | ReactiveAgent<TOutput, TState> {
  const base = {
    _tag: "Agent" as const,
    config,
  };

  // If activateOn is present, mark as reactive
  if (config.activateOn !== undefined) {
    return { ...base, _reactive: true as const };
  }

  return base;
}
```

---

### Task 4: Create runReactive() Function

**File:** `packages/internal/core/src/api/run-reactive.ts` (NEW)

```typescript
import { SignalBus, type Signal, createSignal } from "@signals/bus";
import type { Provider, ProviderInput, RunContext } from "@signals/core";
import type { ReactiveAgent, ActivationContext } from "./types.js";

/**
 * Options for runReactive execution.
 */
export type RunReactiveOptions = {
  /** Default provider if agent doesn't specify one */
  provider?: Provider;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Run ID for correlation */
  runId?: string;
};

/**
 * Result of reactive execution.
 */
export type RunReactiveResult<T = unknown> = {
  /** Final output from the agent */
  output: T;
  /** All signals emitted during execution */
  signals: readonly Signal[];
  /** Execution metrics */
  metrics: {
    durationMs: number;
    activations: number;
  };
};

/**
 * Execute a single reactive agent.
 *
 * 1. Creates SignalBus
 * 2. Subscribes agent based on activateOn
 * 3. Emits harness:start
 * 4. Waits for agent execution
 * 5. Returns result with all signals
 */
export async function runReactive<TOutput, TState>(
  agent: ReactiveAgent<TOutput, TState>,
  input: unknown,
  options?: RunReactiveOptions,
): Promise<RunReactiveResult<TOutput>> {
  const startTime = Date.now();
  const runId = options?.runId ?? crypto.randomUUID();
  const bus = new SignalBus();

  // Get provider (agent override or default)
  const provider = agent.config.provider ?? options?.provider;
  if (!provider) {
    throw new Error("No provider specified. Set provider on agent or in options.");
  }

  // Track activations
  let activations = 0;
  let output: TOutput | undefined;
  let activationPromise: Promise<void> | null = null;

  // Subscribe agent to its activation patterns
  const patterns = agent.config.activateOn ?? ["harness:start"];

  bus.subscribe(patterns, async (signal) => {
    // Build activation context
    const ctx: ActivationContext<TState> = {
      signal,
      state: (agent.config.state ?? {}) as TState,
      input,
    };

    // Check guard condition
    if (agent.config.when && !agent.config.when(ctx)) {
      return; // Guard blocked activation
    }

    // Mark activation
    activations++;
    bus.emit(createSignal("agent:activated", {
      agent: "default", // TODO: agent name
      trigger: signal.name,
    }));

    // Execute provider
    activationPromise = executeProvider(bus, provider, input, {
      signal: options?.signal,
      runId,
    }).then((result) => {
      output = result as TOutput;

      // Emit declared signals
      for (const signalName of agent.config.emits ?? []) {
        bus.emit(createSignal(signalName, { output: result }));
      }
    });

    await activationPromise;
  });

  // Emit harness:start to trigger subscribed agents
  bus.emit(createSignal("harness:start", { input }));

  // Wait for activation to complete (simple single-agent case)
  // TODO: Quiescence detection for multi-agent
  await activationPromise;

  // Emit harness:end
  const durationMs = Date.now() - startTime;
  bus.emit(createSignal("harness:end", { durationMs, output }));

  return {
    output: output as TOutput,
    signals: bus.history(),
    metrics: {
      durationMs,
      activations,
    },
  };
}

/**
 * Execute a provider and emit all its signals to the bus.
 */
async function executeProvider(
  bus: SignalBus,
  provider: Provider,
  input: unknown,
  ctx: RunContext,
): Promise<unknown> {
  const providerInput: ProviderInput = {
    messages: [{ role: "user", content: String(input) }],
  };

  let output: unknown;

  for await (const signal of provider.run(providerInput, ctx)) {
    bus.emit(signal);

    // Capture final output from provider:end
    if (signal.name === "provider:end") {
      output = (signal.payload as { output: unknown }).output;
    }
  }

  return output;
}
```

---

### Task 5: Export New APIs

**File:** `packages/internal/core/src/api/index.ts`

Add exports:

```typescript
export { runReactive, type RunReactiveOptions, type RunReactiveResult } from "./run-reactive.js";
export type { ReactiveAgent, ActivationContext } from "./types.js";
export { isReactiveAgent } from "./types.js";
```

**File:** `packages/open-harness/core/src/index.ts`

Re-export from public package.

---

### Task 6: Add Dependencies

**File:** `packages/internal/core/package.json`

Add workspace dependencies:

```json
{
  "dependencies": {
    "@signals/core": "workspace:*",
    "@signals/bus": "workspace:*"
  }
}
```

---

### Task 7: Unit Tests

**File:** `packages/internal/core/tests/api/run-reactive.test.ts` (NEW)

```typescript
import { describe, test, expect, mock } from "bun:test";
import { agent, runReactive } from "../src/api/index.js";
import { createSignal, PROVIDER_SIGNALS } from "@signals/core";

// Mock provider that yields predictable signals
function createMockProvider(response: string) {
  return {
    type: "mock",
    displayName: "Mock Provider",
    capabilities: { streaming: true },
    async *run(input, ctx) {
      yield createSignal(PROVIDER_SIGNALS.START, { input });
      yield createSignal(PROVIDER_SIGNALS.TEXT_DELTA, { content: response });
      yield createSignal(PROVIDER_SIGNALS.TEXT_COMPLETE, { content: response });
      yield createSignal(PROVIDER_SIGNALS.END, {
        output: { content: response },
        durationMs: 100,
      });
      return { content: response };
    },
  };
}

describe("runReactive", () => {
  test("emits harness:start and harness:end", async () => {
    const myAgent = agent({
      prompt: "You are helpful",
      activateOn: ["harness:start"],
      provider: createMockProvider("Hello!"),
    });

    const result = await runReactive(myAgent, "Hi");

    const signalNames = result.signals.map(s => s.name);
    expect(signalNames).toContain("harness:start");
    expect(signalNames).toContain("harness:end");
  });

  test("activates agent on matching signal", async () => {
    const myAgent = agent({
      prompt: "Analyze data",
      activateOn: ["harness:start"],
      emits: ["analysis:complete"],
      provider: createMockProvider("Analysis done"),
    });

    const result = await runReactive(myAgent, "data");

    expect(result.signals.map(s => s.name)).toContain("agent:activated");
    expect(result.signals.map(s => s.name)).toContain("analysis:complete");
    expect(result.metrics.activations).toBe(1);
  });

  test("respects when guard", async () => {
    const myAgent = agent({
      prompt: "Only run with valid input",
      activateOn: ["harness:start"],
      when: (ctx) => ctx.input !== null,
      provider: createMockProvider("Ran"),
    });

    // Should NOT activate when input is null
    const result = await runReactive(myAgent, null);
    expect(result.metrics.activations).toBe(0);
  });

  test("emits declared signals after completion", async () => {
    const myAgent = agent({
      prompt: "Trade executor",
      activateOn: ["harness:start"],
      emits: ["trade:proposed", "trade:executed"],
      provider: createMockProvider("Trade executed"),
    });

    const result = await runReactive(myAgent, "Buy AAPL");

    const names = result.signals.map(s => s.name);
    expect(names).toContain("trade:proposed");
    expect(names).toContain("trade:executed");
  });

  test("uses agent provider override", async () => {
    const customProvider = createMockProvider("Custom response");

    const myAgent = agent({
      prompt: "Test",
      activateOn: ["harness:start"],
      provider: customProvider,
    });

    const result = await runReactive(myAgent, "test");
    expect(result.output).toEqual({ content: "Custom response" });
  });
});
```

---

### Task 8: Integration Test with Real Provider

**File:** `packages/internal/core/tests/api/run-reactive.live.test.ts` (NEW)

```typescript
import { describe, test, expect } from "bun:test";
import { agent, runReactive } from "../src/api/index.js";
import { ClaudeProvider } from "@signals/provider-claude";

const isLiveTest = () => process.env.LIVE_SDK === "1";

describe("runReactive Live Integration", () => {
  test.skipIf(!isLiveTest())("executes with real Claude provider", async () => {
    const analyst = agent({
      prompt: "You are a helpful assistant. Respond briefly.",
      activateOn: ["harness:start"],
      emits: ["response:complete"],
      provider: new ClaudeProvider(),
    });

    const result = await runReactive(analyst, "Say hello");

    expect(result.output).toBeDefined();
    expect(result.signals.length).toBeGreaterThan(3);
    expect(result.signals.map(s => s.name)).toContain("harness:start");
    expect(result.signals.map(s => s.name)).toContain("response:complete");
  });
});
```

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `packages/internal/core/src/api/types.ts` | Modify | Add reactive properties to AgentConfig |
| `packages/internal/core/src/api/agent.ts` | Modify | Set _reactive flag when activateOn present |
| `packages/internal/core/src/api/run-reactive.ts` | Create | New runReactive() function |
| `packages/internal/core/src/api/index.ts` | Modify | Export new APIs |
| `packages/internal/core/package.json` | Modify | Add @signals/* dependencies |
| `packages/open-harness/core/src/index.ts` | Modify | Re-export runReactive |
| `packages/internal/core/tests/api/run-reactive.test.ts` | Create | Unit tests |
| `packages/internal/core/tests/api/run-reactive.live.test.ts` | Create | Live integration tests |

---

## Dependencies

```
@signals/core (types, createSignal, PROVIDER_SIGNALS)
    │
    ▼
@signals/bus (SignalBus, pattern matching)
    │
    ▼
@internal/core (agent, runReactive)
    │
    ▼
@signals/provider-claude (for live tests)
```

---

## Open Questions

### Q1: Agent Naming

How should agents be named in single-agent `runReactive()`?

**Options:**
- A) Always "default" for unnamed agents
- B) Derive from variable name (not possible at runtime)
- C) Require explicit `name` property on agent

**Recommendation:** Option A for now, add optional `name` property in future.

### Q2: Template Expansion

The architecture doc shows `{{ input }}` in prompts. Should this be in F2 or deferred to F3 (Template Expansion)?

**Recommendation:** Defer to F3. Keep F2 focused on reactive activation.

### Q3: Quiescence Detection

For single agent, we just wait for the activation promise. Multi-agent quiescence is more complex.

**Recommendation:** Simple await for F2. Quiescence detection in E1 (Multi-Agent Signals).

---

## Success Criteria

- [ ] `agent({ activateOn, emits, when, provider })` compiles and works
- [ ] `runReactive()` emits `harness:start` and `harness:end`
- [ ] Agent activates on matching signal pattern
- [ ] Guard condition (`when`) blocks activation when false
- [ ] Declared `emits` signals are emitted after agent completes
- [ ] Per-agent `provider` override works
- [ ] All provider signals flow through SignalBus
- [ ] Result contains complete signal history
- [ ] Unit tests pass
- [ ] Live integration test passes (when LIVE_SDK=1)

---

## Estimated Effort

| Task | Complexity | Lines of Code |
|------|------------|---------------|
| Types extension | Low | ~40 |
| agent() update | Low | ~10 |
| runReactive() | Medium | ~100 |
| Exports | Low | ~10 |
| Unit tests | Medium | ~100 |
| Live tests | Low | ~30 |
| **Total** | Medium | ~290 |
