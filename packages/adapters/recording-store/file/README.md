---
title: "Recording Store (File)"
lastUpdated: "2026-01-07T18:56:45.187Z"
lastCommit: "73246e0e776d28d9da3c7dbc6ba8ba0d9ba93e7c"
lastCommitDate: "2026-01-07T18:23:27Z"
scope:
  - recording
  - persistence
  - adapters
---

# @open-harness/recording-store-file

File-based recording store implementation for Open Harness.

## Purpose

Implements the `RecordingStore` interface from `@open-harness/core` using the
local filesystem. Stores recording metadata/output/error in JSON and events in
JSONL for append-friendly playback.

## Storage Format

- `recording-<id>.json` — metadata + output + error
- `recording-<id>.jsonl` — recorded events (one JSON object per line)

## Usage

```ts
import { FileRecordingStore } from "@open-harness/recording-store-file";

const store = new FileRecordingStore({ directory: "./recordings" });
```
