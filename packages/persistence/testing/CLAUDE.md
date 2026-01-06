# @open-harness/persistence-testing

Shared testing utilities and contracts for persistence implementations.

## Purpose

Provides contract tests and helper functions to ensure all `RunStore` implementations conform to the same interface and behavior. Used by persistence implementations (like `persistence-sqlite`) to validate correctness.

## Key Files

- **`src/contracts/run-store-contract.ts`** - Contract test suite
  - `runStoreContract(name, createStore)` - Main contract test function
  - `sampleRuntimeEvent(flowName)` - Helper to create test events
  - `sampleRunSnapshot(runId)` - Helper to create test snapshots
  - Tests: event sequencing, snapshot save/load, event ordering, multiple runs

## Contract Tests

The `runStoreContract` function validates:
1. **Event Sequencing** - Events are stored with sequence numbers and retrieved in order
2. **Snapshot Persistence** - Snapshots can be saved and retrieved by runId
3. **Event Ordering** - Events maintain order across multiple appends
4. **Multiple Runs** - Different runs have isolated event streams
5. **Empty Runs** - Handles runs with no events gracefully

## Usage

```typescript
import { runStoreContract } from "@open-harness/persistence-testing";
import { SqliteRunStore } from "@open-harness/persistence-sqlite";

runStoreContract("SqliteRunStore", () => ({
  store: new SqliteRunStore({ filename: ":memory:" }),
  cleanup: () => {}, // Optional cleanup function
}));
```

## Dependencies

- `@open-harness/sdk` - For `RunStore` interface and types
- `bun:test` - For test framework
