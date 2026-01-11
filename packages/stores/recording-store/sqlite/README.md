---
title: "Recording Store (SQLite)"
lastUpdated: "2026-01-07T19:33:33.732Z"
lastCommit: "1419d161946d58160f1b915b27c81d53749cd653"
lastCommitDate: "2026-01-07T18:56:43Z"
scope:
  - recording
  - persistence
  - stores
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
