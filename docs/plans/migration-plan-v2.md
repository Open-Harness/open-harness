# Migration Plan v2: Codex Runtime Consolidation

> **STATUS: HISTORICAL / COMPLETED (2026-01-27)**
> This migration plan has been fully executed. It is preserved as a historical record.
> Do not update this document. For the current architecture, see the codebase directly.

> Supersedes: `migration-plan.md` (giggly-puzzling-thompson) + `architecture-decisions.md` (Q1-Q9)
> Predecessor: `noble-finding-koala` (State-First DX Redesign, Phases 1-6 completed)
> Validated by: `validation-report.md` (7-agent audit, 2026-01-27)

## Overview

Complete migration from the old event-driven API (`define-event [OLD]`, `define-handler [OLD]`, `WorkflowDef [was Definition]`) to the new state-first API (`agent()`, `phase()`, `workflow()`, `executeWorkflow`). The new API already exists under `packages/core/src/Next/`. This plan makes it THE implementation, deleting all legacy code.

**Current state**: The new API exists in `Next/` but the server, CLI, tests, and docs still use the old API. The runtime lacks EventStore/EventBus integration, WorkflowObserver protocol, and has a HITL queue bug.

**Goal**: Single cohesive implementation. No dual APIs. No "Next" namespace. Native Effect layer integration.

---

## Architecture Decisions (Embedded)

These were decided in the Q1-Q9 review. One decision (Q3) is revised based on validation findings.

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| Q1 | Runtime ↔ EventStore/EventBus | **Native Effect layers** | Idiomatic Effect; no callback plumbing; server just provides layers |
| Q2 | Programs/ directory | **Delete; fold survivors into server/utils** | Designed for old event-loop; surviving helpers are thin wrappers |
| Q3 | Provider types location | **Rename Domain/Agent.ts → Domain/Provider.ts** | REVISED from Q3-B. Validation found Option B creates service layer inversion (Services/ → Next/) |
| Q4 | EventStore/EventBus required? | **Always required** | One code path; standalone provides in-memory implementations |
| Q5 | Domain/ directory name | **Keep as-is** | Not worth churn during migration |
| Q6 | Testing philosophy | **No mocks; real implementations only** | Delete all stubs; use LibSQL `:memory:` + real EventBusLive |
| Q7 | Default persistence | **Always persist; default `./scaffold.db`** | Only tests use `:memory:` |
| Q8 | Consumer callback API | **WorkflowObserver protocol** | Single `observer` object with concern-mapped methods |
| Q9 | Implementation naming | **Live suffix convention** | `EventStoreLive` → `EventStoreLive`; standard Effect convention |

---

## Phase Dependencies

```
Phase 0: Pre-migration bugfixes
    │
Phase 1: Type foundation + native layers
    │
    ├── Phase 2: Server routes (needs native layers from Phase 1)
    │     │
    ├── Phase 3: Rewrite surviving programs (needs Phase 1 types)
    │     │
    └─────┤
          │
    Phase 4: Delete old execution pipeline (needs Phases 2 + 3)
          │
    Phase 5: Delete old domain types + stubs + clean exports (needs Phase 4)
          │
    Phase 6: WorkflowObserver protocol (needs Phase 5 — clean surface)
          │
    Phase 7: CLI + tests (needs Phases 5 + 6)
          │
    Phase 8: Rename & cosmetic (needs Phase 7)
          │
    Phase 9: Documentation (final)
```

## Gate Checks (Every Phase)

Before committing each phase:
```bash
pnpm typecheck   # Zero type errors
pnpm lint        # Zero lint errors
pnpm test        # All tests pass (mark expected failures with .todo if mid-migration)
```

Only proceed to next phase when gate passes.

---

## Phase 0: Pre-Migration Bugfixes

Fix pre-existing bugs that block correct runtime behavior regardless of migration.

### 0.1 Fix HITL queue deadlock

**Files**: `packages/core/src/Next/execute.ts`, `packages/core/src/Next/runtime.ts`

**Problem**: `respond()` in `execute.ts` feeds a local `inputBuffer`/`inputWaiters` array but is NOT connected to the runtime's `Queue.take(ctx.inputQueue)`. Any HITL workflow deadlocks waiting for input that never arrives.

**Fix**: Wire `respond()` → `Queue.offer(inputQueue, value)`. The `inputQueue` Ref from runtime must be accessible in execute.ts's `WorkflowExecution` handle.

### 0.2 Fix real-time event streaming

**Files**: `packages/core/src/Next/execute.ts`

**Problem**: Events are buffered post-hoc (after execution completes), not streamed in real-time. The async iterator replays events after completion instead of yielding them as they occur.

**Fix**: Add an event channel/queue to RuntimeContext. `emitEvent` pushes to this queue. The async iterator pulls from it during execution, yielding events as they happen.

**Verification**: `pnpm typecheck && pnpm test`. Write a test that verifies events are yielded before workflow completion.

---

## Phase 1: Type Foundation + Native Layers

Wire EventStore and EventBus as native Effect dependencies in the runtime. Migrate event types so everything compiles.

### 1.1 Migrate AnyEvent → AnyInternalEvent in Services

**Files**: All files importing `AnyEvent` from `Domain/Event.js`

**Why first**: EventStore/EventBus services currently import `AnyEvent` from the old `Domain/Event.ts`. The runtime emits `AnyInternalEvent` from `Next/types.ts`. These types must align BEFORE the runtime can use the services.

Update these files to import `AnyInternalEvent` from `Next/types.js` (or a shared location):

**Services (update import, keep file)**:
- `Services/EventStore.ts` — change `AnyEvent` → `AnyInternalEvent`
- `Services/EventBus.ts` — change `AnyEvent` → `AnyInternalEvent`
- `Services/StateCache.ts` — change `AnyEvent` → `AnyInternalEvent`

**Note**: `Services/AgentService.ts` and `Services/WorkflowRuntime.ts` are deleted in Phase 5 — skip them here. `Programs/` files are deleted in Phase 4 — skip them here. External packages (`server/`, `client/`) are rewritten in Phases 2 and 7.

### 1.2 Add EventStore + EventBus to runtime (Q1 + Q4)

**File**: `packages/core/src/Next/runtime.ts`

Add `EventStore` and `EventBus` to `executeWorkflow`'s R type:

```typescript
export const executeWorkflow = <S, Input, Phases extends string = never>(
  workflow: WorkflowDef<S, Input, Phases>,
  options: ExecuteOptions<Input>
): Effect.Effect<
  WorkflowResult<S>,
  WorkflowError | AgentError | ProviderError | StoreError | ...,
  ProviderRegistry | ProviderRecorder | ProviderModeContext | EventStore | EventBus
>
```

Refactor `emitEvent` to persist and broadcast natively:

```typescript
const emitEvent = <S>(ctx: RuntimeContext<S>, name: string, payload: unknown) =>
  Effect.gen(function*() {
    const store = yield* EventStore
    const bus = yield* EventBus
    const causedBy = yield* Ref.get(ctx.lastEventIdRef)
    const event = yield* makeInternalEvent(name, payload, causedBy)
    yield* store.append(ctx.sessionId, event)
    yield* bus.publish(ctx.sessionId, event)
    yield* Ref.update(ctx.eventsRef, (events) => [...events, event])
    yield* Ref.set(ctx.lastEventIdRef, event.id)
    return event
  })
```

Add `sessionId` to `RuntimeContext` (required for store/bus calls). Add `sessionId` to `ExecuteOptions` (optional, auto-generated if not provided).

### 1.3 Create in-memory EventStore + EventBus implementations

**File**: `packages/core/src/Layers/InMemory.ts` (new)

For standalone/testing use:

```typescript
export const InMemoryEventStore: Layer.Layer<EventStore> = ...
export const InMemoryEventBus: Layer.Layer<EventBus> = ...
```

`InMemoryEventStore` uses a `Map<string, AnyInternalEvent[]>` in-process.
`InMemoryEventBus` uses `Effect.void` for publish, `Stream.empty` for subscribe (no subscribers in standalone).

### 1.4 Update execute.ts and run.ts to provide layers

**Files**: `packages/core/src/Next/execute.ts`, `packages/core/src/Next/run.ts`

The standalone APIs must provide EventStore + EventBus layers:

```typescript
// execute.ts
const runtimeLayer = Layer.mergeAll(
  ProviderRegistryLayer,
  ProviderModeLayer,
  ProviderRecorderLayer,
  InMemoryEventStore,   // new
  InMemoryEventBus      // new
)
```

### 1.5 Add `resume` options to ExecuteOptions

**File**: `packages/core/src/Next/runtime.ts`

- Add optional `resumeState?: S` and `resumePhase?: string` to `ExecuteOptions`
- If `resumeState` is present, skip `workflow.start()` and use `resumeState` directly
- Set `currentPhaseRef` to `resumePhase` if provided

### 1.6 Add ProviderRegistry layer to server

**Files**: `packages/server/src/http/Server.ts`, `packages/server/src/OpenScaffold.ts`

- Add `providers?: Record<string, AgentProvider>` to config types
- Build `ProviderRegistry` layer from the map, merge into runtime layer

**Verification**: `pnpm typecheck` passes. No existing behavior changed. Old API still works alongside new types.

---

## Phase 2: Rewrite Server Routes

Switch server from `Programs.execute-workflow [was event-loop]()` to `executeWorkflow()`. With Q1 native layers, this is simpler — no callback wiring needed.

### 2.1 Update route types

**File**: `packages/server/src/http/Routes.ts`

- Change `RouteContext.workflow` from `WorkflowDef [was Definition]<S>` to new `WorkflowDef`
- Add `ProviderRegistry`, `EventStore`, `EventBus` to route environment (already in ManagedRuntime)
- Remove `stateCache` from RouteContext (no longer needed)

### 2.2 Rewrite createSessionRoute

No callback bridge needed (Q1 Option B):

```typescript
const sessionId = yield* makeSessionId()
const fiber = yield* Effect.forkDaemon(
  executeWorkflow(ctx.workflow, { input, sessionId })
)
return { status: 201, body: { sessionId } }
```

The runtime persists events via its native EventStore/EventBus layers.

### 2.3 Rewrite getSessionStateRoute

Use new `computeStateAt` that scans `state:updated` events (no handlers needed).

### 2.4 Rewrite resumeSessionRoute

Use `executeWorkflow` with `resumeState` option instead of old `resumeSession`.

### 2.5 Rewrite postSessionInputRoute

Replace `UserInput.create()` (old event factory) with `makeInternalEvent(EVENTS.INPUT_RESPONSE, ...)`.

### 2.6 Update Server.ts and OpenScaffold.ts

- Change config type from `WorkflowDef [was Definition]<S>` to `WorkflowDef`
- Remove `makeStateCache` call
- EventStore/EventBus already in ManagedRuntime layer

**Verification**: Server package typechecks with new types. Routes use `executeWorkflow`.

---

## Phase 3: Rewrite Surviving Programs

Rewrite the programs that survive deletion. Key change: `computeStateAt` must stop depending on `runHandler` (which is deleted in Phase 4).

### 3.1 Rewrite computeStateAt as pure function

**File**: `packages/core/src/Programs/State/computeStateAt.ts`

New implementation scans for last `state:updated` event at or before position. Returns its `.state` payload. **No handler replay. No `runHandler` import.** Remove `handlers` parameter entirely.

This is now a pure function operating on an event array — no services needed:

```typescript
export const computeStateAt = <S>(
  events: ReadonlyArray<AnyInternalEvent>,
  position: number
): S | undefined => {
  // Scan backwards from position for last state:updated event
  for (let i = Math.min(position, events.length) - 1; i >= 0; i--) {
    if (events[i].name === "state:updated") {
      return events[i].payload.state as S
    }
  }
  return undefined
}
```

### 3.2 Simplify StateCache

**File**: `packages/core/src/Services/StateCache.ts`

- Remove `handlers` from `StateCacheConfig`
- Remove import of `HandlerDefinition`

### 3.3 Rewrite resumeSession.ts

**File**: `packages/core/src/Programs/Session/resumeSession.ts`

Use new runtime's resume option instead of old `execute-workflow [was event-loop]`.

### 3.4 Rewrite Programs/workflow.ts

**File**: `packages/core/src/Programs/workflow.ts`

- Delete `runWorkflow` (replaced by `executeWorkflow`)
- Rewrite `loadWorkflowTape` to use new `computeStateAt` (no handlers parameter)

### 3.5 Update createSession.ts

**File**: `packages/core/src/Programs/Recording/createSession.ts`

- Replace `WorkflowStarted.create({ goal })` with new event factory
- Or simplify: just generate sessionId (runtime emits workflow:started natively)

**Verification**: Programs module typechecks without old Execution/ imports.

---

## Phase 4: Delete Old Execution Pipeline

All callers have been rewritten in Phases 2-3. Safe to delete.

### 4.1 Delete files

- `packages/core/src/Programs/Execution/execute-workflow [was event-loop].ts`
- `packages/core/src/Programs/Execution/processEvent.ts`
- `packages/core/src/Programs/Execution/runAgentWithStreaming.ts`
- `packages/core/src/Programs/Execution/mapStreamEvent.ts`
- `packages/core/src/Programs/Execution/runHandler.ts`
- Delete entire `Execution/` directory

### 4.2 Update Programs/index.ts

Remove all Execution exports: `execute-workflow [was event-loop]`, `mapStreamEvent`, `processEvent`, `runAgentWithStreaming`, `runHandler`.

### 4.3 Pre-deletion verification

```bash
# Verify no remaining imports of deleted functions in non-test production code
grep -r "execute-workflow [was event-loop]\|processEvent\|mapStreamEvent\|runAgentWithStreaming\|runHandler" \
  packages/core/src packages/server/src --include="*.ts" \
  --exclude-dir=Execution
```

### 4.4 Mark broken tests as `.todo`

Tests that directly test deleted code (`programs.test.ts`, `vcr-routes.test.ts`, `map-stream-event.test.ts`) should be marked with `.todo` or `it.skip` with a comment: `// Rewritten in Phase 7`. This prevents build failures between Phase 4 and Phase 7.

**Verification**: `pnpm typecheck` passes. `pnpm test` passes (skipped tests noted).

---

## Phase 5: Delete Old Domain Types + Stubs + Clean Exports

### 5.1 Delete old domain files

- `packages/core/src/Domain/Event.ts` (old event factories — `define-event [OLD]`, `WorkflowStarted`, `UserInput`, etc.)
- `packages/core/src/Domain/Handler.ts` (handler definitions)
- `packages/core/src/Domain/Workflow.ts` (old `WorkflowDef [was Definition]`, `WorkflowCallbacks`)

### 5.2 Refactor Domain/Agent.ts → Domain/Provider.ts (Q3 revised)

Keep provider types (`AgentProvider`, `AgentStreamEvent`, `ProviderRunOptions`, `AgentRunResult`, `ProviderMode`). Delete old `Agent<S,O>`, `AgentOptions<S,O>`. Rename file to `Provider.ts`.

Update `Domain/index.ts` to export from `Provider.ts`.

### 5.3 Update Domain/index.ts

Remove old exports. Keep: IDs, Context, Errors, Hash, Interaction, Provider types.

### 5.4 Delete old services

- `packages/core/src/Services/AgentService.ts` (old service abstraction)
- `packages/core/src/Services/WorkflowRuntime.ts` (old service)

### 5.5 Delete stubs directory (Q6)

- Delete entire `packages/core/src/Layers/Stubs/` directory
- Update `packages/core/src/Layers/index.ts` — remove Stubs export

### 5.6 Clean up core/src/index.ts

- Remove "Legacy Namespace" section (`export * as Next`)
- Remove "Legacy API (deprecated)" section
- Remove all `@deprecated` exports
- No `export * as Next` should remain
- Only new API exports remain

### 5.7 Delete Programs/ directory (Q2)

Move surviving helpers to their new homes:
- `computeStateAt` → `packages/core/src/Next/utils.ts` (pure function)
- `loadSession`, `forkSession`, `resumeSession` → `packages/server/src/programs/` (server-only)
- `observeEvents` → `packages/server/src/programs/` (server-only, thin wrapper on `bus.subscribe()`)
- `loadWorkflowTape` → `packages/server/src/programs/` (server-only)
- `recordEvent` → **deleted** (runtime handles this natively via Q1)
- `createSession` → **deleted** (runtime emits workflow:started natively)
- `getCurrentState` → **deleted** (use `computeStateAt(events, events.length)`)
- `observeState` → **deleted** (dead code)

Delete `packages/core/src/Programs/` directory entirely.

Update `packages/core/src/index.ts` — remove `Programs` export.

**Verification**: Core package fully clean. `pnpm typecheck` passes. No old types, stubs, or Programs/ remain.

---

## Phase 6: WorkflowObserver Protocol (Q8)

### 6.1 Define observer types

**File**: `packages/core/src/Next/types.ts`

```typescript
export interface StreamChunk {
  readonly type: "text" | "thinking"
  readonly delta: string
  readonly agent: string
}

export interface InputRequest {
  readonly prompt: string
  readonly type: "freeform" | "approval" | "choice"
  readonly options?: ReadonlyArray<string>
}

export interface WorkflowObserver<S> {
  stateChanged?(state: S, patches?: ReadonlyArray<Patch>): void
  phaseChanged?(phase: string, from?: string): void
  streamed?(chunk: StreamChunk): void
  agentStarted?(info: { agent: string; phase?: string }): void
  agentCompleted?(info: { agent: string; output: unknown; durationMs: number }): void
  inputRequested?(request: InputRequest): Promise<string>
  started?(sessionId: string): void
  completed?(result: WorkflowResult<S>): void
  errored?(error: WorkflowError): void
  event?(event: AnyInternalEvent): void
}
```

### 6.2 Add observer dispatch to runtime

**File**: `packages/core/src/Next/runtime.ts`

Add optional `observer?: WorkflowObserver<S>` to `ExecuteOptions`. Add dispatch calls at key runtime points:

- `emitEvent` → `observer.event?.(event)` + specific method dispatch based on event name
- State update → `observer.stateChanged?.(state, patches)`
- Phase enter → `observer.phaseChanged?.(phase, from)`
- Agent start/complete → `observer.agentStarted/Completed?.(info)`
- Input request → `observer.inputRequested?.(request)`
- Workflow complete → `observer.completed?.(result)`

### 6.3 Update run.ts to accept observer

**File**: `packages/core/src/Next/run.ts`

Add `observer?: WorkflowObserver<S>` to `RunOptions`. Keep flat callbacks as deprecated for one version, with internal mapping to observer.

### 6.4 Add RuntimeConfig.database field (Q7)

**File**: `packages/core/src/Next/execute.ts`

```typescript
export interface RuntimeConfig {
  readonly providers: Record<string, AgentProvider>
  readonly database?: string  // Default: "./scaffold.db"; ":memory:" for tests
  readonly mode?: ProviderMode
}
```

Build EventStore/EventBus layers from this field. Default to `./scaffold.db` (Q7).

### 6.5 Export new types from index.ts

Update `packages/core/src/index.ts` to export `WorkflowObserver`, `StreamChunk`, `InputRequest`.

**Verification**: `pnpm typecheck && pnpm test`. Observer is wired but optional — existing code unaffected.

---

## Phase 7: CLI + Test Rewrite

### 7.1 Rewrite test-workflow.ts

**File**: `apps/cli/test-workflow.ts`

From old `WorkflowDef [was Definition]` with `handler-list [OLD]`, `agents[]`, `until()` to new `agent()` + `workflow()` factories.

### 7.2 Update CLI run command

**File**: `apps/cli/src/commands/run.tsx`

Pass loaded workflow (new type) to `OpenScaffold.createServer()`. Add providers config.

### 7.3 Verify useEventStream.ts

**File**: `apps/cli/src/ui/hooks/useEventStream.ts`

Already handles new event names (`state:updated`, `phase:entered`, `text:delta`). Should work without changes. If consuming locally (not via SSE), can use `WorkflowObserver` directly.

### 7.4 Rewrite server tests

Un-skip the `.todo` tests from Phase 4 and rewrite:

- `packages/server/test/programs.test.ts` — rewrite to use new API
- `packages/server/test/vcr-routes.test.ts` — update route context types
- `packages/server/test/vcr-integration.test.ts` — rewrite workflow definitions
- `packages/server/test/hitl-integration.test.ts` — rewrite with new HITL patterns
- `packages/server/test/eventbus-live.test.ts` — update event creation
- `packages/server/test/workflow-bridge.test.ts` — delete or rewrite

All tests use real implementations with ephemeral databases (Q6):

```typescript
const makeTestLayer = () =>
  Layer.mergeAll(
    EventStoreLive({ url: ":memory:" }),
    StateSnapshotStoreLive({ url: ":memory:" }),
    ProviderRecorderLive({ url: ":memory:" }),
    Layer.effect(EventBus, EventBusLive),
    Layer.succeed(ProviderModeContext, { mode: "playback" })
  )
```

### 7.5 Delete obsolete tests

- `packages/core/test/map-stream-event.test.ts` (tests deleted code)
- Review `packages/core/test/interaction.test.ts` for old API usage

### 7.6 Update client tests

- `packages/client/test/hooks.test.tsx` — update mock workflows
- `packages/client/test/http-client-vcr.test.ts` — update workflow definitions

### 7.7 Verify Next tests still pass

`packages/core/test/next-*.test.ts` should continue passing (they use the new API).

**Verification**: `pnpm test` — all tests pass, no `.todo` or `.skip` remaining.

---

## Phase 8: Rename & Cosmetic (Q9)

### 8.1 Rename types

- `InternalEvent` → `Event`
- `AnyInternalEvent` → `AnyEvent`
- `InternalEventId` → `EventId`
- `makeInternalEvent` → `makeEvent`
- `makeInternalEventId` → `makeEventId`

### 8.2 Rename implementations to Live convention (Q9)

- `EventStoreLive` → `EventStoreLive`
- `StateSnapshotStoreLive` → `StateSnapshotStoreLive`
- `ProviderRecorderLive` → `ProviderRecorderLive`

File renames in `packages/server/src/store/`:
- `EventStore.ts` → `EventStoreLive.ts`
- `StateSnapshotStore.ts` → `StateSnapshotStoreLive.ts`
- `ProviderRecorderLive.ts` → `ProviderRecorderLive.ts`

Update all import sites (~43 total across server, testing, and core).

### 8.3 Rename Next/ directory (optional)

Consider renaming `Next/` to `Runtime/` or `DSL/`, or keep as-is since it's an internal detail (public API is through `index.ts`).

**Verification**: `pnpm typecheck && pnpm test` all pass.

---

## Phase 9: Documentation

### Files to update

- `README.md` — Quick-start section uses old API
- `docs/getting-started.md` — Complete workflow example
- `docs/reference/mental-model.md` — Foundational doc with old examples
- `docs/reference/architecture.md` — Architecture diagrams/examples
- `docs/reference/reference-implementation.md` — Entirely old API
- `docs/guides/extension.md` — Extension examples
- `docs/guides/testing.md` — Test examples
- `docs/guides/error-handling.md` — Error handling patterns
- `HANDOFF.md` — References old structure

All docs rewritten to show only the new `agent()`, `phase()`, `workflow()` API with Immer-style `update()`.

**Verification**: Read through all docs, ensure no old API references remain.

---

## Post-Migration Directory Structure

```
packages/core/src/
├── Next/                    ← (or Runtime/ after Phase 8.3)
│   ├── agent.ts             ← agent() factory
│   ├── phase.ts             ← phase() factory
│   ├── workflow.ts          ← workflow() factory
│   ├── types.ts             ← Event types, WorkflowObserver, StreamChunk, InputRequest
│   ├── provider.ts          ← ProviderRegistry + runAgentDef
│   ├── runtime.ts           ← executeWorkflow (uses EventStore/EventBus natively)
│   ├── execute.ts           ← async iterator API
│   ├── run.ts               ← Promise API with observer
│   ├── utils.ts             ← computeStateAt (pure function)
│   └── index.ts
├── Domain/                  ← shared types
│   ├── Provider.ts          ← AgentProvider, AgentStreamEvent, ProviderRunOptions
│   ├── Ids.ts
│   ├── Context.ts
│   ├── Errors.ts
│   ├── Hash.ts
│   ├── Interaction.ts
│   └── index.ts
├── Services/                ← Effect Context.Tags (interfaces only)
│   ├── EventStore.ts
│   ├── EventBus.ts
│   ├── StateSnapshotStore.ts
│   ├── ProviderRecorder.ts
│   ├── ProviderMode.ts
│   └── index.ts
├── Layers/
│   ├── InMemory.ts          ← in-memory EventStore/EventBus for standalone
│   ├── Logger.ts
│   └── index.ts
└── index.ts                 ← public API surface (no deprecated exports)

packages/server/src/
├── programs/                ← server-specific helpers (moved from core)
│   ├── observeEvents.ts
│   ├── loadSession.ts
│   ├── forkSession.ts
│   └── resumeSession.ts
├── http/
├── provider/
├── store/                   ← EventStoreLive, StateSnapshotStoreLive, ProviderRecorderLive
└── index.ts
```

---

## Validation Findings Addressed

| Finding | Severity | Addressed In |
|---------|----------|-------------|
| HITL queue deadlock | CRITICAL | Phase 0.1 |
| AnyEvent import sprawl (24 files) | BLOCK | Phase 1.1 (services), Phase 2 (server), Phase 4/5 (deleted files) |
| Phase 1 stale (callbacks vs native layers) | BLOCK | Phase 1.2 (native layers from the start) |
| computeStateAt depends on runHandler | BLOCK | Phase 3.1 (rewrite as pure function, no runHandler) |
| 3 decisions missing from phases | WARN | Q2 → Phase 5.7, Q8 → Phase 6, Q9 → Phase 8.2 |
| Service layer inversion (Q3-B) | WARN | Q3 revised to Option A (Domain/Provider.ts) |
| Real-time event streaming broken | WARN | Phase 0.2 |
| Tests break between Phase 4-7 | WARN | Phase 4.4 (mark as .todo, un-skip in Phase 7) |
| EventStore/EventBus type mismatch | WARN | Phase 1.1 (migrate before wiring) |
| Phase 6.5 too late | WARN | Moved to Phase 1.1 |
