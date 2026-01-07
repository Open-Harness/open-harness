---
lastUpdated: "2026-01-07T19:33:33.732Z"
lastCommit: "1419d161946d58160f1b915b27c81d53749cd653"
lastCommitDate: "2026-01-07T18:56:43Z"
---
# @open-harness/recording-store-testing

Shared testing utilities for recording store implementations.

## Purpose

Provides contract tests and sample data to validate `RecordingStore`
implementations. Ensures consistent behavior across stores.

## Key Files

- `src/contracts/recording-store-contract.ts` — contract tests and sample data

## Contract Coverage

- Save/load recordings
- Event order preservation
- List filters (providerType/inputHash)

## Dependencies

- `@open-harness/core` — Recording types and interface
- `bun:test` — test framework
