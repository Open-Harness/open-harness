# Migration Plan Validation Report

**Date**: 2026-01-27
**Branch**: `impl/codex`
**Auditor**: Billie (Claude Opus 4.5)
**Mode**: Read-only audit — no files modified

---

## Source Documents

### PRD (Plan Under Validation)

- [Migration Plan (Phases 1-10)](./migration-plan.md)
- [Architecture Decisions (Q1-Q9)](./architecture-decisions.md)

### Primary Research Transcripts

Each agent ran as an independent background task with full codebase read access:

| Agent | Scope | Transcript |
|-------|-------|------------|
| Agent 1: Type Signature Audit | `runtime.ts`, `execute.ts`, `EventStore.ts`, `EventBus.ts` | [a396caa](/private/tmp/claude/-Users-abuusama-projects-open-harness-worktrees-scaffold-codex/tasks/a396caa.output) |
| Agent 2: Import Graph Validation | All `*.ts` across `core/`, `server/`, `client/` | [a89f67c](/private/tmp/claude/-Users-abuusama-projects-open-harness-worktrees-scaffold-codex/tasks/a89f67c.output) |
| Agent 3: Programs/ Deletion Feasibility | `Programs/**/*.ts`, `Routes.ts`, server tests | [a562d0b](/private/tmp/claude/-Users-abuusama-projects-open-harness-worktrees-scaffold-codex/tasks/a562d0b.output) |
| Agent 4: WorkflowObserver Protocol | `runtime.ts`, `execute.ts`, `run.ts`, `useEventStream.ts` | [aa6bfa1](/private/tmp/claude/-Users-abuusama-projects-open-harness-worktrees-scaffold-codex/tasks/aa6bfa1.output) |
| Agent 5: Live Naming + Stubs Deletion | `Layers/Stubs/`, store implementations, all test files | [aef98cb](/private/tmp/claude/-Users-abuusama-projects-open-harness-worktrees-scaffold-codex/tasks/aef98cb.output) |
| Agent 6: Phase Ordering Audit | `migration-plan.md`, `architecture-decisions.md` cross-reference | [ab54aec](/private/tmp/claude/-Users-abuusama-projects-open-harness-worktrees-scaffold-codex/tasks/ab54aec.output) |
| Agent 7: DX Surface Audit | `core/src/index.ts`, `run.ts`, `execute.ts`, public API surface | [a42d805](/private/tmp/claude/-Users-abuusama-projects-open-harness-worktrees-scaffold-codex/tasks/a42d805.output) |

---

## Summary

| Metric | Count |
|--------|-------|
| **BLOCK** | 1 (Agent 2: Import Graph) |
| **WARN** | 6 (Agents 1, 3, 4, 5, 6, 7) |
| **PASS** | 0 |

### Top 3 Critical Items

1. **HITL Queue Deadlock** (Agent 4) — `respond()` in `execute.ts` is disconnected from runtime's `Queue.take()`. Any HITL workflow will hang indefinitely. Pre-existing bug independent of migration.

2. **AnyEvent Import Sprawl** (Agent 2) — 24 files import `AnyEvent` from `Domain/Event.ts`. Phase 6.5 only lists 2 files to update. Deleting `Domain/Event.ts` without updating all 24 breaks the entire codebase. Must create a complete migration checklist and move Phase 6.5 to Phase 1.4.

3. **Phase 1 is Stale / Q1 Not Implemented** (Agents 1, 6) — Phase 1 adds an `onEvent` callback, but Q1 chose Option B (native Effect layers). Phase 1 must be rewritten to add `EventStore`/`EventBus` to runtime's R type. Cascades to Phase 2 and Phase 6.5 ordering.

### Secondary Critical Items

4. **`computeStateAt` depends on `runHandler`** (Agent 3) — Surviving function imports a function marked for deletion.

5. **3 architectural decisions missing from phases** (Agent 6) — Q2 (delete Programs/), Q8 (WorkflowObserver), Q9 (Live naming) have no migration phase.

6. **Service layer inversion risk** (Agent 5) — Q3 Option B (move provider types to `Next/`) would make `Services/` depend on application layer. Recommend Option A (`Domain/Provider.ts`).

---

## Agent Reports

### Agent 1: Type Signature Audit

**Status: WARN**

#### Findings

- `executeWorkflow` does NOT require `EventStore | EventBus` in R type — Q1 decided Option B (native layers) but code implements Option A (callback bridge)
- `emitEvent` only accumulates in `eventsRef`, never calls `EventStore.append()` or `EventBus.publish()`
- No `if (onEvent)` branching (correctly absent per Q4 decision)
- `ProviderRegistry`/`ProviderRecorder`/`ProviderModeContext` correctly required in R type
- Type mismatch: `EventStore`/`EventBus` services use `AnyEvent` from Domain, but runtime uses `AnyInternalEvent` from Next

#### Risks

- Q1 Option B decided but not implemented — runtime signature is incomplete
- Type incompatibility between `EventStore`/`EventBus` (`AnyEvent`) and runtime (`AnyInternalEvent`) will cause compile failures when wired together

---

### Agent 2: Import Graph Validation

**Status: BLOCK**

#### Findings

- **17 internal files + 7 external files** import `AnyEvent` from `Domain/Event.js` — Phase 6.5 only lists 2 files to update
- `Domain/Agent.ts` exports both new provider types AND old `Agent<S,O>` — 13 files depend on it, can't delete without coordinated migration
- `Routes.ts` still calls `Programs.execute-workflow [was event-loop]()` — Phase 5 deletion will break server if Phase 2 not completed first
- `resumeSession.ts` and `workflow.ts` import `execute-workflow [was event-loop]` — must be rewritten in Phase 4 before Phase 5 deletion

#### Risks

- **BLOCK**: Domain/Event.ts deletion breaks 24 files (17 internal + 7 external) without coordinated AnyEvent migration
- **BLOCK**: Domain/Agent.ts deletion breaks 13 files without Q3 provider type relocation
- **BLOCK**: Routes.ts still uses old execution pipeline — Phase 2 must complete before Phase 5

#### AnyEvent Migration Checklist (Phase 6.5 expansion)

Files requiring `AnyEvent` -> `AnyInternalEvent` update:

**Services (5)**:
- [ ] `Services/EventStore.ts`
- [ ] `Services/EventBus.ts`
- [ ] `Services/StateCache.ts`
- [ ] `Services/AgentService.ts`
- [ ] `Services/WorkflowRuntime.ts`

**Programs (9)**:
- [ ] `Programs/Execution/execute-workflow [was event-loop].ts`
- [ ] `Programs/Execution/mapStreamEvent.ts`
- [ ] `Programs/Execution/processEvent.ts`
- [ ] `Programs/Execution/runAgentWithStreaming.ts`
- [ ] `Programs/Execution/runHandler.ts`
- [ ] `Programs/Session/resumeSession.ts`
- [ ] `Programs/Session/loadSession.ts`
- [ ] `Programs/State/computeStateAt.ts`
- [ ] `Programs/Recording/createSession.ts`

**External packages (7)**:
- [ ] `packages/server/src/http/Routes.ts`
- [ ] `packages/server/src/http/SSE.ts`
- [ ] `packages/server/src/services/EventBusLive.ts`
- [ ] `packages/client/src/react/hooks.ts`
- [ ] `packages/client/src/react/context.ts`
- [ ] `packages/client/src/HttpClient.ts`
- [ ] `packages/client/src/Contract.ts`

---

### Agent 3: Programs/ Deletion Feasibility

**Status: WARN**

#### Findings

- `computeStateAt` (SURVIVE) imports `runHandler` (DELETE) — plan doesn't address this dependency
- `execute-workflow [was event-loop]` callers in Routes.ts need Phase 2 rewrite first — temporal dependency on phase order
- `recordEvent` callers need Phase 2 rewrite — 4 test call sites, 8 production call sites
- `observeState` is dead code — safe to delete but not explicitly listed
- All surviving programs (`computeStateAt`, `loadSession`, `forkSession`, `resumeSession`, `observeEvents`) are correctly scoped

#### Deletion Dependency Chain

```
execute-workflow [was event-loop]           (DELETE)
 +-- processEvent        (DELETE)
 |    +-- runHandler          (DELETE — but computeStateAt depends on it!)
 |    +-- runAgentWithStreaming (DELETE)
 |         +-- mapStreamEvent      (DELETE)
 |         +-- recordEvent         (DELETE)
 |    +-- recordEvent         (DELETE)

computeStateAt      (SURVIVE)
 +-- runHandler          (DELETE — CONFLICT)
```

#### Risks

- **BLOCK**: `runHandler` must be preserved or inlined — `computeStateAt` depends on it
- Tests (`programs.test.ts`, `vcr-routes.test.ts`) break in Phase 5 but not rewritten until Phase 8 — builds fail in between

---

### Agent 4: WorkflowObserver Protocol Feasibility

**Status: WARN**

#### Findings

- `WorkflowObserver<S>` protocol defined in architecture-decisions.md Q8 but does not exist in codebase
- Runtime's `emitEvent` has no observer dispatch — only collects in `eventsRef`
- `execute.ts` async iterator buffers events post-hoc (lines 305-308), not real-time streaming
- `run.ts` flat callbacks (`onEvent`, `onStateChange`, `onText`, etc.) will break if replaced without migration path
- **CRITICAL**: HITL `respond()` in `execute.ts` is NOT wired to runtime's `Queue.take(ctx.inputQueue)` — deadlock
- CLI `useEventStream.ts` is compatible with observer pattern

#### Risks

- **CRITICAL**: HITL input queue not connected — `respond()` doesn't feed `Queue.take()`, workflows will deadlock
- Observer not threaded through runtime — no mechanism to call observer methods during execution
- Async iterator doesn't stream real-time events — UI will stall until completion

#### Feasibility Matrix

| Component | Feasible? | Blocker |
|-----------|-----------|---------|
| Observer dispatch in emitEvent | Yes | None |
| HITL inputRequested integration | Partial | Queue wiring broken |
| Real-time streaming for iterator | Partial | Event buffering prevents live updates |
| Coexistence with execute iterator | Yes | Designed as separate APIs |
| CLI reimplementation | Yes (deferred) | Observer not yet available |

---

### Agent 5: Live Naming + Stubs Deletion Impact

**Status: WARN**

#### Findings

- `Layers/Stubs/` directory (8 stubs) is exported but NOT actively imported by any tests — safe to delete
- LibSQL `:memory:` URLs confirmed working — test layer strategy is valid
- Live naming rename impact: `EventStoreLive` -> `EventStoreLive` requires 18 site updates; `StateSnapshotStoreLive` -> 14; `ProviderRecorderLive` -> 11
- No centralized `makeTestLayer()` helper exists — tests repeat layer setup across files
- Moving provider types to `Next/provider.ts` (Q3 Option B) would create service layer inversion — `Services/` should not depend on `Next/`

#### Risks

- Service layer inversion if Q3 Option B is implemented — recommend Q3 Option A (`Domain/Provider.ts`) instead
- Live naming churn is mechanical but touches 43+ import sites — defer to Phase 9

---

### Agent 6: Phase Ordering and Dependency Audit

**Status: WARN**

#### Findings

- Phase 1 is STALE — designed for callback bridge but Q1 decided native layers
- Phase 2 implementation details wrong — uses `onEvent` callback wiring that's obsolete per Q1
- Phase 6.5 (EventStore/EventBus import update) happens too late — should be Phase 1.4, breaks typecheck in Phase 2
- Phase 9 rename collision is safe but needs clarification
- **3 architecture decisions have NO corresponding migration phase**: Q2 (delete Programs/), Q8 (WorkflowObserver), Q9 (Live naming)
- Phase 7.3 relies on event names from Phase 1 but doesn't declare the dependency

#### Missing Phases

| Decision | Description | Suggested Phase |
|----------|-------------|-----------------|
| Q2 | Delete Programs/ directory | Phase 5.5 or 6.8 |
| Q8 | WorkflowObserver protocol | Phase 1.4 or 7.x |
| Q9 | Live naming convention | Phase 9.x |

#### Risks

- Phase 1 callback bridge is dead code — Q1 decided native layers, implementing callbacks wastes effort
- Phase 2 won't compile if EventStore/EventBus imports not updated first (Phase 6.5 too late)
- Programs/ cleanup undefined — Q2 decision says delete but no phase does it

---

### Agent 7: DX Surface Audit

**Status: WARN**

#### Findings

- `@deprecated` exports still present in `core/index.ts` (lines 192-272) — Phase 6.7 cleanup not done
- `export * as Next` namespace still exported — should be deleted
- `WorkflowObserver<S>`, `StreamChunk`, `InputRequest` types not defined or exported
- `run()`, `execute()`, `runSimple()`, `runWithText()` don't accept `observer` parameter
- `RuntimeConfig.database` field missing — Q7 decision (always persist, default `./scaffold.db`) not reflected
- Provider types still in `Domain/Agent.ts`, not `Next/provider.ts` per Q3 decision
- `ExecuteOptions` has no `onEvent` callback — Phase 1.1 infrastructure incomplete

#### Post-Migration API Checklist

- [x] `@deprecated` exports remain — **FAIL**
- [x] `export * as Next` namespace remains — **FAIL**
- [x] `export * as Legacy` namespace not required — **PASS**
- [ ] `WorkflowObserver<S>` exported — **FAIL** (not defined)
- [ ] `StreamChunk` type exported — **FAIL** (not defined)
- [ ] `InputRequest` type exported — **FAIL** (not defined)
- [ ] `run()` accepts observer parameter — **FAIL** (uses flat callbacks)
- [ ] `execute()` accepts observer parameter — **FAIL** (no callbacks)
- [ ] `RuntimeConfig.database` field present — **FAIL**
- [ ] Provider types in `Next/provider.ts` per Q3 — **FAIL** (still in `Domain/Agent.ts`)

---

## Consolidated Recommendations

### Phase 1 Rewrite (Highest Priority)

1. **Rewrite Phase 1 for Q1 Option B** — Add `EventStore`/`EventBus` to runtime's R type, not a callback
2. **Move Phase 6.5 to Phase 1.4** — Update EventStore/EventBus imports to `AnyInternalEvent` before Phase 2
3. **Fix HITL queue wiring** — Connect `respond()` to `Queue.offer(inputQueue)` immediately (pre-migration bug)

### Phase Gaps to Fill

4. **Create Phase 5.5**: Delete Programs/ per Q2 decision, with explicit file list and runHandler resolution
5. **Create Phase 7.4**: Add WorkflowObserver protocol per Q8 decision
6. **Create Phase 9.x**: Rename implementations to Live convention per Q9 decision

### Design Corrections

7. **Q3: Use Option A** (rename `Domain/Agent.ts` -> `Domain/Provider.ts`) instead of Option B to avoid service layer inversion
8. **Expand Phase 6.5 checklist** from 2 files to all 24 files importing `AnyEvent`
9. **Resolve runHandler dependency** — move out of Execution/ or inline into `computeStateAt`
10. **Clarify test timing** — tests break in Phase 5 but rewritten in Phase 8; add skip markers or move rewrites earlier
