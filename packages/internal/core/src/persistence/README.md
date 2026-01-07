---
title: "Persistence Layer"
lastUpdated: "2026-01-07T00:00:00Z"
lastCommit: "placeholder"
lastCommitDate: "2026-01-07T00:00:00Z"
scope:
  - persistence
  - run-store
  - snapshots
---

# Persistence

Optional storage layer for run events and snapshots. This enables resume and
replay across process restarts.

## What's here
- RunStore: interface for event and snapshot storage.
- InMemoryRunStore: ephemeral store for tests and demos (web-compatible).

## Structure
- run-store.ts: RunStore interface.
- memory-run-store.ts: InMemoryRunStore implementation.

Note: SqliteRunStore has been moved to `@open-harness/run-store-sqlite` package.

## Usage
Pass a RunStore to the runtime so it can append events and save snapshots.

```ts
import { createRuntime } from "../runtime/runtime.js";
import { InMemoryRunStore } from "../persistence/memory-run-store.js";

const store = new InMemoryRunStore();
const runtime = createRuntime({ flow, registry, store });
```

Use SQLite when you need durability across restarts:

```ts
import { SqliteRunStore } from "@open-harness/run-store-sqlite";

const store = new SqliteRunStore({ filename: "runs.db" });
const runtime = createRuntime({ flow, registry, store });
```

## Resume
To resume a paused run, pass the stored run id to the runtime:

```ts
const pausedSnapshot = await runtime.run();
const resumed = createRuntime({
  flow,
  registry,
  store,
  resume: { runId: pausedSnapshot.runId! },
});
await resumed.run();
```

## Extending
- Implement RunStore for your storage backend (Postgres, S3, etc.).
- If you add new event shapes, ensure they remain serializable in your store.
- Keep snapshot schema compatible with RunSnapshot in runtime/snapshot.ts.
