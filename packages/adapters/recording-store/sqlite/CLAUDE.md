---
lastUpdated: "2026-01-07T18:56:45.187Z"
lastCommit: "73246e0e776d28d9da3c7dbc6ba8ba0d9ba93e7c"
lastCommitDate: "2026-01-07T18:23:27Z"
---
# @open-harness/recording-store-sqlite

SQLite-based recording persistence for Open Harness recordings.

## Purpose

Implements the `RecordingStore` interface from `@open-harness/core` using Bun's
SQLite database. Stores metadata/output/error in `recordings` and events in
`recording_events` with deterministic ordering via `seq`.

## Key Files

- `src/sqlite-recording-store.ts` — main implementation
- `tests/sqlite-recording-store.test.ts` — contract tests via `recordingStoreContract`

## Usage

```typescript
import { SqliteRecordingStore } from "@open-harness/recording-store-sqlite";

const store = new SqliteRecordingStore({ filename: "recordings.db" });
```

## Dependencies

- `@open-harness/core` — Recording types and interface
- `@open-harness/recording-store-testing` — contract tests (dev dependency)
- `bun:sqlite` — SQLite database
