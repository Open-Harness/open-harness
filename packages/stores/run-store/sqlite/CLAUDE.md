---
lastUpdated: "2026-01-07T19:33:33.732Z"
lastCommit: "1419d161946d58160f1b915b27c81d53749cd653"
lastCommitDate: "2026-01-07T18:56:43Z"
---
# @open-harness/run-store-sqlite

SQLite-based persistence implementation for Open Harness run state storage.

## Purpose

Implements the `RunStore` interface from `@open-harness/core` using Bun's built-in SQLite database. Provides persistent storage for:
- Run snapshots (state, outputs, node status, edge status, loop counters, inbox, agent sessions)
- Runtime events (for replay, debugging, and audit trails)
- Event sequencing for ordered retrieval

## Key Files

- **`src/sqlite-run-store.ts`** - Main `SqliteRunStore` class implementing `RunStore`
  - Uses Bun's `Database` from `bun:sqlite`
  - Creates two tables: `run_events` and `run_snapshots`
  - Implements `appendEvent()`, `loadEvents()`, `saveSnapshot()`, `getSnapshot()`
  - Handles event sequencing with auto-incrementing sequence numbers

- **`tests/sqlite-store.test.ts`** - Tests using `runStoreContract` from `@open-harness/run-store-testing`

## Usage

```typescript
import { SqliteRunStore } from "@open-harness/run-store-sqlite";

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

- `@open-harness/core` - For `RunStore` interface and types
- `@open-harness/run-store-testing` - For contract tests (dev dependency)
- `bun:sqlite` - Built-in SQLite support
