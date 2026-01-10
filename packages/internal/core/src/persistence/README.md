---
title: "Persistence Layer"
lastUpdated: "2026-01-10T09:45:31.811Z"
lastCommit: "a9e5f66d3940822fd2e20996fc38318fe0aede14"
lastCommitDate: "2026-01-10T05:58:49Z"
scope:
  - persistence
  - run-store
  - snapshots
---

# Persistence

Optional storage layer for run history and snapshots.

## What's here

| File | Description |
|------|-------------|
| `run-store.ts` | `RunStore` interface |
| `memory-run-store.ts` | `InMemoryRunStore` implementation |

**Note**: `SqliteRunStore` has been moved to `@open-harness/run-store-sqlite` package.

## v0.3.0 Recording

In v0.3.0, signal recording is the primary way to capture and replay runs:

```typescript
import { createHarness, MemorySignalStore, ClaudeProvider } from "@open-harness/core";

const { agent, runReactive } = createHarness<MyState>();
const store = new MemorySignalStore();

// Record mode - captures all signals
const result = await runReactive({
  agents: { analyzer },
  state: initialState,
  provider: new ClaudeProvider(),
  fixture: "my-test",
  mode: "record",
  store,
});

// Replay mode - no API calls, signals from store
const replay = await runReactive({
  agents: { analyzer },
  state: initialState,
  fixture: "my-test",
  mode: "replay",
  store,
});
```

See `packages/signals/README.md` for `MemorySignalStore` details.

## RunStore Interface

For persistent run history (separate from signal recording):

```typescript
interface RunStore {
  saveRun(run: RunRecord): Promise<void>;
  getRun(id: string): Promise<RunRecord | null>;
  listRuns(query?: RunQuery): Promise<RunRecord[]>;
  deleteRun(id: string): Promise<void>;
}

interface RunRecord {
  id: string;
  createdAt: number;
  completedAt?: number;
  state: unknown;
  metadata?: Record<string, unknown>;
}
```

## InMemoryRunStore

Ephemeral storage for tests and demos:

```typescript
import { InMemoryRunStore } from "@internal/core";

const store = new InMemoryRunStore();

// Save run record
await store.saveRun({
  id: "run-001",
  createdAt: Date.now(),
  state: { result: "success" },
});

// Retrieve
const run = await store.getRun("run-001");

// List all
const runs = await store.listRuns();
```

## SQLite Persistence

For durable run history across restarts:

```typescript
import { SqliteRunStore } from "@open-harness/run-store-sqlite";

const store = new SqliteRunStore({ filename: "runs.db" });

// Same interface as InMemoryRunStore
await store.saveRun({ id: "run-001", createdAt: Date.now(), state: {} });
```

## Extending

To implement a custom `RunStore`:

1. Implement the `RunStore` interface
2. Handle serialization for your storage backend
3. Export from your package

```typescript
import type { RunStore, RunRecord, RunQuery } from "@internal/core";

export class PostgresRunStore implements RunStore {
  async saveRun(run: RunRecord): Promise<void> {
    // Implement
  }

  async getRun(id: string): Promise<RunRecord | null> {
    // Implement
  }

  async listRuns(query?: RunQuery): Promise<RunRecord[]> {
    // Implement
  }

  async deleteRun(id: string): Promise<void> {
    // Implement
  }
}
```

## Recording vs Run Store

| Feature | Signal Recording | Run Store |
|---------|-----------------|-----------|
| Purpose | Replay workflows | Track run history |
| Data | All signals | Run metadata + final state |
| Use case | Testing, debugging | Auditing, history UI |
| Store | `MemorySignalStore` | `RunStore` |

Most applications only need signal recording. `RunStore` is for applications that need persistent run history with querying.

## See Also

- `packages/signals/README.md` — Signal-based recording
- `packages/stores/` — Store implementations
