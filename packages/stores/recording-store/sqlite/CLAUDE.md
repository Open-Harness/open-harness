---
lastUpdated: "2026-01-07T19:33:33.732Z"
lastCommit: "1419d161946d58160f1b915b27c81d53749cd653"
lastCommitDate: "2026-01-07T18:56:43Z"
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
