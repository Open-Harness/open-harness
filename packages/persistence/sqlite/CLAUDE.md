# @open-harness/persistence-sqlite

SQLite-based persistence implementation for Open Harness run state storage.

## Purpose

Implements the `RunStore` interface from `@open-harness/sdk` using Bun's built-in SQLite database. Provides persistent storage for:
- Run snapshots (state, outputs, node status, edge status, loop counters, inbox, agent sessions)
- Runtime events (for replay, debugging, and audit trails)
- Event sequencing for ordered retrieval

## Key Files

- **`src/sqlite-run-store.ts`** - Main `SqliteRunStore` class implementing `RunStore`
  - Uses Bun's `Database` from `bun:sqlite`
  - Creates two tables: `run_events` and `run_snapshots`
  - Implements `appendEvent()`, `loadEvents()`, `saveSnapshot()`, `getSnapshot()`
  - Handles event sequencing with auto-incrementing sequence numbers

- **`tests/sqlite-store.test.ts`** - Tests using `runStoreContract` from `@open-harness/persistence-testing`

## Usage

```typescript
import { SqliteRunStore } from "@open-harness/persistence-sqlite";

// In-memory database for testing
const store = new SqliteRunStore({ filename: ":memory:" });

// File-based database for production
const store = new SqliteRunStore({ filename: "./runs.db" });

// Pre-configured database instance
const db = new Database("runs.db");
const store = new SqliteRunStore({ db });
```

## Implementation Details

- Uses prepared statements for performance
- Indexes on `(run_id, seq)` for efficient event retrieval
- Stores events and snapshots as JSON strings
- Sequence numbers ensure event ordering within a run
- Thread-safe (SQLite handles concurrency)

## Dependencies

- `@open-harness/sdk` - For `RunStore` interface and types
- `@open-harness/persistence-testing` - For contract tests (dev dependency)
- `bun:sqlite` - Built-in SQLite support
