---
lastUpdated: "2026-01-10T10:11:36.649Z"
lastCommit: "150d2ad147832f2553c0dbfb779f1a466c0a001b"
lastCommitDate: "2026-01-10T09:55:26Z"
---
# @open-harness/stores

Signal storage implementations for Open Harness.

## Status: Stub Package

This package is a placeholder for future persistent stores. The v0.2.0 stores (`FileRecordingStore`, `SqliteRecordingStore`, `SqliteRunStore`) were deleted as part of the v0.3.0 migration.

## Current Exports

```typescript
import { MemorySignalStore, type SignalStore } from "@open-harness/stores";
```

Re-exports the in-memory store from core for convenience.

## Available Stores

### MemorySignalStore (Current)

In-memory signal storage, ideal for testing and short-lived sessions:

```typescript
import { MemorySignalStore } from "@open-harness/stores";
import { runReactive } from "@open-harness/core";

const store = new MemorySignalStore();

const result = await runReactive({
  agents: { myAgent },
  state: initialState,
  provider,
  signalStore: store,
});

// Access recorded signals
const recording = await store.load("run-id");
```

## Planned Future Stores

- `FileSignalStore` - File-based signal persistence (JSON/JSONL)
- `SqliteSignalStore` - SQLite-backed signal storage
- `S3SignalStore` - Cloud storage for signals

## SignalStore Interface

Custom stores must implement:

```typescript
interface SignalStore {
  append(runId: string, signal: Signal): Promise<void>;
  load(runId: string): Promise<Recording | null>;
  checkpoint(runId: string, index: number): Promise<void>;
  list(query?: RecordingQuery): Promise<RecordingMetadata[]>;
  delete(runId: string): Promise<void>;
}
```

## See Also

- [@open-harness/core](../core/README.md) - Core API
- [Recording example](../../../examples/recording-replay/) - Recording patterns
