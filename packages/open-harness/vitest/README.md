---
lastUpdated: "2026-01-11T10:45:35.208Z"
lastCommit: "7c119005269c88d906afffaea1ab3b283a07056f"
lastCommitDate: "2026-01-11T07:21:34Z"
---
# @open-harness/vitest

Custom Vitest matchers and reporters for testing Open Harness reactive agent workflows.

## Installation

```bash
bun add -D @open-harness/vitest vitest
```

## Quick Start

### 1. Configure Vitest

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { OpenHarnessReporter } from "@open-harness/vitest";

export default defineConfig({
  test: {
    // Auto-register matchers
    setupFiles: ["@open-harness/vitest/setup"],
    // Optional: Add quality gate reporter
    reporters: ["default", new OpenHarnessReporter({ passRate: 0.8 })],
  },
});
```

### 2. Write Tests

```typescript
import { describe, it, expect } from "vitest";
import { createWorkflow, ClaudeHarness } from "@open-harness/vitest";

const { agent, runReactive } = createWorkflow<{ input: string }>();

describe("My Agent", () => {
  it("completes workflow successfully", async () => {
    const myAgent = agent({
      prompt: "Process: {{ state.input }}",
      activateOn: ["workflow:start"],
      emits: ["processing:complete"],
    });

    const result = await runReactive({
      agents: { myAgent },
      state: { input: "test" },
      harness: new ClaudeHarness(),
    });

    // Signal assertions
    expect(result.signals).toContainSignal("workflow:start");
    expect(result.signals).toContainSignal("processing:complete");
    expect(result.signals).toHaveSignalsInOrder([
      "workflow:start",
      "agent:activated",
      "workflow:end",
    ]);

    // Metric assertions
    expect(result).toHaveLatencyUnder(5000);
    expect(result).toCostUnder(0.10);
    expect(result).toHaveTokensUnder(1000);
  });
});
```

## Signal Matchers

### `toContainSignal(matcher)`

Assert that signals contain a matching signal.

```typescript
// Exact name match
expect(signals).toContainSignal("workflow:start");

// Glob patterns
expect(signals).toContainSignal("agent:*");      // Single segment wildcard
expect(signals).toContainSignal("harness:**");   // Multi-segment wildcard

// With payload matching (partial deep equality)
expect(signals).toContainSignal({
  name: "agent:activated",
  payload: { agent: "analyst" },
});

// Negation
expect(signals).not.toContainSignal("error:*");
```

### `toHaveSignalCount(matcher, count)`

Assert exact number of matching signals.

```typescript
// Count by name
expect(signals).toHaveSignalCount("agent:activated", 2);

// Count with glob
expect(signals).toHaveSignalCount("harness:*", 4);

// Count with payload condition
expect(signals).toHaveSignalCount(
  { name: "agent:activated", payload: { agent: "analyst" } },
  1
);

// Assert signal is absent
expect(signals).toHaveSignalCount("error:*", 0);
```

### `toHaveSignalsInOrder(patterns[])`

Assert signals appear in specified order (trajectory validation).

```typescript
// Validate workflow sequence
expect(signals).toHaveSignalsInOrder([
  "workflow:start",
  "agent:activated",
  "analysis:complete",
  "workflow:end",
]);

// With payload conditions
expect(signals).toHaveSignalsInOrder([
  { name: "agent:activated", payload: { agent: "analyst" } },
  "analysis:complete",
  { name: "agent:activated", payload: { agent: "trader" } },
]);

// With glob patterns
expect(signals).toHaveSignalsInOrder([
  "workflow:*",
  "agent:*",
  "harness:*",
  "workflow:*",
]);
```

## Metric Matchers

These matchers work on `RunResult` objects from `runReactive()`.

### `toHaveLatencyUnder(ms)`

```typescript
expect(result).toHaveLatencyUnder(5000);  // < 5 seconds
```

### `toCostUnder(usd)`

```typescript
expect(result).toCostUnder(0.01);  // < $0.01
```

### `toHaveTokensUnder(count)`

```typescript
expect(result).toHaveTokensUnder(1000);  // < 1000 total tokens
```

## Quality Gate Reporter

The `OpenHarnessReporter` enforces pass rate thresholds in CI:

```typescript
// vitest.config.ts
import { OpenHarnessReporter } from "@open-harness/vitest";

export default defineConfig({
  test: {
    reporters: [
      "default",
      new OpenHarnessReporter({
        passRate: 0.9,      // Require 90% pass rate
        // Future options:
        // maxLatencyMs: 10000,
        // maxCostUsd: 1.00,
      }),
    ],
  },
});
```

Output:
```
------------------------------------
Open Harness: 18/20 passed (90.0%)
All gates passed
------------------------------------
```

If pass rate is below threshold, `process.exitCode` is set to 1.

## Manual Setup

If you prefer not to use `setupFiles`, register matchers manually:

```typescript
import { beforeAll } from "vitest";
import { matchers, signalMatchers } from "@open-harness/vitest";

beforeAll(() => {
  expect.extend(matchers);
  expect.extend(signalMatchers);
});
```

## Re-exports

For convenience, this package re-exports common types from `@open-harness/core`:

```typescript
import {
  agent,
  workflow,
  createWorkflow,
  runReactive,
  MemorySignalStore,
  ClaudeHarness,
  type WorkflowResult,
  type ReactiveWorkflowConfig,
} from "@open-harness/vitest";
```

## TypeScript Support

Type declarations are included. Custom matchers will have full autocomplete in your IDE.

```typescript
// types.ts augments vitest's Assertion interface
declare module "vitest" {
  interface Assertion<T> extends OpenHarnessMatchers<T>, SignalMatchers<T> {}
}
```

## See Also

- [Testing example](../../../examples/testing-signals/) - Comprehensive test patterns
- [@open-harness/core](../core/README.md) - Core API
- [Vitest documentation](https://vitest.dev/) - Test framework
