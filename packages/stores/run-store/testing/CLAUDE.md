---
lastUpdated: "2026-01-07T19:33:33.732Z"
lastCommit: "1419d161946d58160f1b915b27c81d53749cd653"
lastCommitDate: "2026-01-07T18:56:43Z"
---
# @open-harness/run-store-testing

Shared testing utilities and contracts for persistence implementations.

## Purpose

Provides contract tests and helper functions to ensure all `RunStore` implementations conform to the same interface and behavior. Used by persistence implementations (like `run-store-sqlite`) to validate correctness.

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
import { runStoreContract } from "@open-harness/run-store-testing";
import { SqliteRunStore } from "@open-harness/run-store-sqlite";

runStoreContract("SqliteRunStore", () => ({
  store: new SqliteRunStore({ filename: ":memory:" }),
  cleanup: () => {}, // Optional cleanup function
}));
```

## Dependencies

- `@open-harness/core` - For `RunStore` interface and types
- `bun:test` - For test framework
