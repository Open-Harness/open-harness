---
title: "Recording Store Testing Utilities"
lastUpdated: "2026-01-07T18:56:45.187Z"
lastCommit: "73246e0e776d28d9da3c7dbc6ba8ba0d9ba93e7c"
lastCommitDate: "2026-01-07T18:23:27Z"
scope:
  - recording
  - testing
  - adapters
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
