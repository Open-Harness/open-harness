# Persistence Packages

Persistence implementations for Open Harness run state storage.

## Packages

### `sqlite/`
**@open-harness/persistence-sqlite**

SQLite-based implementation of the `RunStore` interface. Provides persistent storage for:
- Run snapshots (state, outputs, node status)
- Runtime events (for replay and debugging)
- Run metadata (runId, status, timestamps)

**Key Files:**
- `src/sqlite-run-store.ts` - Main implementation using Bun's built-in SQLite
- `tests/sqlite-store.test.ts` - Tests using persistence-testing contract

**Usage:**
```typescript
import { SqliteRunStore } from "@open-harness/persistence-sqlite";

const store = new SqliteRunStore({ path: "./runs.db" });
await store.saveSnapshot(snapshot);
const loaded = await store.getSnapshot(runId);
```

### `testing/`
**@open-harness/persistence-testing**

Shared testing utilities and contracts for persistence implementations. Ensures all persistence implementations conform to the same interface.

**Key Files:**
- `src/contracts/run-store-contract.ts` - Contract tests that validate RunStore implementations
- Provides `runStoreContract()` function for testing any RunStore implementation

**Usage:**
```typescript
import { runStoreContract } from "@open-harness/persistence-testing";

runStoreContract("SqliteRunStore", () => new SqliteRunStore({ path: ":memory:" }));
```

## Interface

All persistence implementations must implement the `RunStore` interface from `@open-harness/sdk`:
- `saveSnapshot(snapshot)` - Persist run state
- `getSnapshot(runId)` - Retrieve run state
- `saveEvent(event)` - Persist runtime event
- `getEvents(runId)` - Retrieve events for a run
