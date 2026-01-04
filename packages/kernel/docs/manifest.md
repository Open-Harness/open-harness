# Kernel V3 Manifest (To-Do)

Last updated: 2026-01-03

This is a task-oriented manifest derived from the architecture. It is not a spec.

## 0. Bootstrap
- [x] Create package.json and tsconfig.json for packages/kernel
- [x] Wire workspace tooling (lint/typecheck/test scripts)
- [x] Add README with quickstart + links to docs

## 1. Core Types + Validation
- [x] Define FlowDefinition / NodeDefinition / EdgeDefinition / StateSchemaDefinition
- [x] Define RuntimeEvent / RuntimeCommand / RunSnapshot
- [x] Add Zod schemas for flow validation
- [x] Add YAML parsing and validation entrypoint

## 2. Runtime Skeleton
- [x] Runtime interface + lifecycle (run, dispatch, onEvent, getSnapshot)
- [x] EventBus implementation
- [x] Command inbox implementation
- [x] StateStore implementation (get/set/patch/snapshot)

## 3. Compiler + Scheduler
- [x] Compiler: validate + normalize graph
- [x] Scheduler: resolve ready nodes (gate any/all)
- [x] Edge status tracking (pending/fired/skipped)
- [x] Loop counters + maxIterations enforcement
- [x] forEach edge fan-out support

## 4. Executor
- [x] Node execution wrapper (policy: retry/timeout)
- [x] Binding resolution + when evaluation
- [x] Output tracking + node status tracking

## 5. Registry + Node Types
- [x] NodeRegistry implementation
- [x] Port core nodes (echo/constant) for smoke tests
- [x] Port claude.agent node (no v2 compatibility)

## 6. Persistence (Optional)
- [x] RunStore interface
- [x] SQLite RunStore implementation (events + snapshots)
- [x] Resume logic: load snapshot + replay

## 7. Transport (Optional)
- [x] WebSocket transport adapter (runtime <-> UI)
- [x] Basic command/event protocol for UI

## 8. Testing
- [ ] Unit tests:
  - [x] bindings
  - [x] when
  - [x] gating
  - [x] loops
  - [x] forEach
  - [x] state
- [x] Integration tests: branching + loops + forEach
- [x] Integration test: parse -> compile -> run (simple flow)
- [x] Contract tests: event stream shape
- [x] Persistence tests: snapshot + resume

## 8.5 Agent Observability (Spec)
- [x] Agent events: start/thinking/text/tool/error/complete
- [x] Event timestamps on runtime events
- [x] Snapshot agentSessions persistence
- [x] Command routing requires runId
- [x] Resume prompt defaults to "continue"
- [x] Mock query + fixture schema + example fixture

## 8.6 E2E + Recording
- [x] E2E test using recorded fixtures
- [x] Fixture recording script
- [x] Recording documentation

## 9. Hard Decisions (Locked)
- [x] Default edge gate: all
- [x] Scheduling: sequential only (deterministic v3.0)
- [x] Event names: stable flow:*, node:*, edge:*, loop:*, command:*
