---
title: "Recording Store Testing Utilities"
lastUpdated: "2026-01-07T19:33:33.732Z"
lastCommit: "1419d161946d58160f1b915b27c81d53749cd653"
lastCommitDate: "2026-01-07T18:56:43Z"
scope:
  - recording
  - testing
  - stores
---

# @open-harness/recording-store-testing

Shared testing utilities and contract tests for `RecordingStore` implementations.

## Purpose

Provides contract tests to ensure all recording stores conform to the same
behavior: save/load/list and event ordering.

## Usage

```ts
import { recordingStoreContract } from "@open-harness/recording-store-testing";
import { SqliteRecordingStore } from "@open-harness/recording-store-sqlite";

recordingStoreContract("SqliteRecordingStore", () => ({
  store: new SqliteRecordingStore({ filename: ":memory:" }),
}));
```
