---
title: "Recording Store (File)"
lastUpdated: "2026-01-07T19:33:33.732Z"
lastCommit: "1419d161946d58160f1b915b27c81d53749cd653"
lastCommitDate: "2026-01-07T18:56:43Z"
scope:
  - recording
  - persistence
  - stores
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
