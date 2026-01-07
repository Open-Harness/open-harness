---
title: "Recording Store (SQLite)"
lastUpdated: "2026-01-07T18:56:45.187Z"
lastCommit: "73246e0e776d28d9da3c7dbc6ba8ba0d9ba93e7c"
lastCommitDate: "2026-01-07T18:23:27Z"
scope:
  - recording
  - persistence
  - adapters
---

# @open-harness/recording-store-sqlite

SQLite-backed recording store implementation for Open Harness.

## Purpose

Implements the `RecordingStore` interface from `@open-harness/core` using Bun's
built-in SQLite database. Stores recording metadata/output/error in one table and
stream events in a separate table with ordered sequencing.

## Schema

```
recordings(id, metadata, output, error)
recording_events(recording_id, seq, timestamp, event)
```

## Usage

```ts
import { SqliteRecordingStore } from "@open-harness/recording-store-sqlite";

const store = new SqliteRecordingStore({ filename: "recordings.db" });
```
