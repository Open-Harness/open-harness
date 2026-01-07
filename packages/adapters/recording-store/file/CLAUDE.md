---
lastUpdated: "2026-01-07T18:56:45.187Z"
lastCommit: "73246e0e776d28d9da3c7dbc6ba8ba0d9ba93e7c"
lastCommitDate: "2026-01-07T18:23:27Z"
---
# @open-harness/recording-store-file

File-based recording persistence for Open Harness recordings.

## Purpose

Implements the `RecordingStore` interface from `@open-harness/core` using the
filesystem. Designed to keep the format simple and inspectable:
- Metadata/output/error in JSON
- Events in JSONL

## Key Files

- `src/file-recording-store.ts` — main implementation
- `tests/file-recording-store.test.ts` — contract tests via `recordingStoreContract`

## Usage

```typescript
import { FileRecordingStore } from "@open-harness/recording-store-file";

const store = new FileRecordingStore({ directory: "./recordings" });
```

## Dependencies

- `@open-harness/core` — Recording types and interface
- `@open-harness/recording-store-testing` — contract tests (dev dependency)
