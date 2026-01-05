# Persistence

Optional storage layer for run events and snapshots. This enables resume and
replay across process restarts.

## What's here
- RunStore: interface for event and snapshot storage.
- InMemoryRunStore: ephemeral store for tests and demos.
- SqliteRunStore: SQLite-backed implementation for Bun.

## Structure
- run-store.ts: RunStore interface.
- sqlite-run-store.ts: SqliteRunStore declaration + options.

## Usage
Pass a RunStore to the runtime so it can append events and save snapshots.

```ts
import { createRuntime } from "../runtime/runtime.js";
import { InMemoryRunStore } from "../persistence/memory-run-store.js";
import { SqliteRunStore } from "../persistence/sqlite-run-store.js";

const store = new InMemoryRunStore();
const runtime = createRuntime({ flow, registry, store });
```

Use SQLite when you need durability across restarts:

```ts
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
