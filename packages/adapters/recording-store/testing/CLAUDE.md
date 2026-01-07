---
lastUpdated: "2026-01-07T18:56:45.187Z"
lastCommit: "73246e0e776d28d9da3c7dbc6ba8ba0d9ba93e7c"
lastCommitDate: "2026-01-07T18:23:27Z"
---
# @open-harness/recording-store-testing

Shared testing utilities for recording store implementations.

## Purpose

Provides contract tests and sample data to validate `RecordingStore`
implementations. Ensures consistent behavior across adapters.

## Key Files

- `src/contracts/recording-store-contract.ts` — contract tests and sample data

## Contract Coverage

- Save/load recordings
- Event order preservation
- List filters (providerType/inputHash)

## Dependencies

- `@open-harness/core` — Recording types and interface
- `bun:test` — test framework
