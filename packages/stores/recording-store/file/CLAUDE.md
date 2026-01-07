---
lastUpdated: "2026-01-07T19:33:33.732Z"
lastCommit: "1419d161946d58160f1b915b27c81d53749cd653"
lastCommitDate: "2026-01-07T18:56:43Z"
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
