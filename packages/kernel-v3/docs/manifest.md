# Kernel V3 Manifest (To-Do)

Last updated: 2026-01-03

This is a task-oriented manifest derived from the architecture. It is not a spec.

## 0. Bootstrap
- [ ] Create package.json and tsconfig.json for packages/kernel-v3
- [ ] Wire workspace tooling (lint/typecheck/test scripts)
- [ ] Add README with quickstart + links to docs

## 1. Core Types + Validation
- [ ] Define FlowDefinition / NodeDefinition / EdgeDefinition / StateSchemaDefinition
- [ ] Define RuntimeEvent / RuntimeCommand / RunSnapshot
- [ ] Add Zod schemas for flow validation
- [ ] Add YAML parsing and validation entrypoint

## 2. Runtime Skeleton
- [ ] Runtime interface + lifecycle (run, dispatch, onEvent, getSnapshot)
- [ ] EventBus implementation
- [ ] Command inbox implementation
- [ ] StateStore implementation (get/set/patch/snapshot)

## 3. Compiler + Scheduler
- [ ] Compiler: validate + normalize graph
- [ ] Scheduler: resolve ready nodes (gate any/all)
- [ ] Edge status tracking (pending/fired/skipped)
- [ ] Loop counters + maxIterations enforcement
- [ ] forEach edge fan-out support

## 4. Executor
- [ ] Node execution wrapper (policy: retry/timeout)
- [ ] Binding resolution + when evaluation
- [ ] Output tracking + node status tracking

## 5. Registry + Node Types
- [ ] NodeRegistry implementation
- [ ] Port core nodes (echo/constant) for smoke tests
- [ ] Port claude.agent node (no v2 compatibility)

## 6. Persistence (Optional)
- [ ] RunStore interface
- [ ] SQLite RunStore implementation (events + snapshots)
- [ ] Resume logic: load snapshot + replay

## 7. Transport (Optional)
- [ ] WebSocket transport adapter (runtime <-> UI)
- [ ] Basic command/event protocol for UI

## 8. Testing
- [ ] Unit tests: bindings, when, gating, loops, state
- [ ] Integration tests: branching + loops + forEach
- [ ] Contract tests: event stream shape
- [ ] Persistence tests: snapshot + resume

## 9. Hard Decisions (Must Lock)
- [ ] Default edge gate: any vs all
- [ ] Sequential vs parallel scheduling in v3.0
- [ ] Event naming conventions (stable or flexible)
