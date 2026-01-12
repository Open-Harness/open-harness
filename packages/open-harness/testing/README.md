---
lastUpdated: "2026-01-11T13:09:48.217Z"
lastCommit: "907d0b728b929259d4b202827743bf044de77fdd"
lastCommitDate: "2026-01-11T10:45:33Z"
---
# @open-harness/testing

Testing utilities for Open Harness signal-based architecture.

## Status: Stub Package

This package is a placeholder for future testing utilities. The v0.2.0 utilities (`MockRuntime`, `runtimeContract`) were deleted as part of the v0.3.0 migration to signal-based providers.

## Current Exports

```typescript
import { MemorySignalStore, Player, type SignalStore } from "@open-harness/testing";
```

Re-exports core testing primitives for convenience.

## Testing Signal-Based Code (v0.3.0)

### Recording and Replay

```typescript
import { MemorySignalStore, Player } from "@open-harness/testing";
import { runReactive } from "@open-harness/core";

// Record signals during execution
const store = new MemorySignalStore();
const result = await runReactive({
  agents: { myAgent },
  state: initialState,
  provider,
  signalStore: store,
});

// Replay with Player (VCR-style)
const player = new Player(result.signals);
player.step();  // Advance one signal
player.goto(5); // Jump to signal index 5
```

### Mocking Providers

```typescript
import { type Provider, createSignal } from "@open-harness/core";

const mockProvider: Provider = {
  run: async function* (input, ctx) {
    yield createSignal("harness:start", {});
    yield createSignal("text:delta", { delta: "Mock response" });
    yield createSignal("harness:end", { output: "Mock response" });
  },
};
```

## Recommended: @open-harness/vitest

For Vitest-based testing with custom matchers, use [@open-harness/vitest](../vitest/README.md):

```typescript
import { expect } from "vitest";
import { signalMatchers } from "@open-harness/vitest";

expect.extend(signalMatchers);

expect(result.signals).toContainSignal("agent:activated");
expect(result.signals).toHaveSignalsInOrder(["harness:start", "harness:end"]);
```

## Planned Future Utilities

- Signal factories for common test patterns
- Provider mocking helpers
- Fixture recording/loading utilities
- Contract tests for custom providers

## See Also

- [@open-harness/vitest](../vitest/README.md) - Vitest matchers
- [Testing example](../../../examples/testing-signals/) - Full test patterns
