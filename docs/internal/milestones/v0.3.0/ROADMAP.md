# Open Harness v0.3.0 Roadmap

**Status:** In Progress (Milestone 3 complete, Milestone 4 in progress)
**Start Date:** 2025-12
**Target:** TBD

---

## Overview

v0.3.0 is organized into 5 milestones with **19 epics** total. Each milestone has clear exit criteria, quality gates, and delivers working software.

**Key Changes**:
- Phase 0 builds core infrastructure (Signal + Provider + Recording) before multi-provider validation
- Recording infrastructure comes BEFORE OpenAI provider (defines signal contract)
- Quality gates at each milestone ensure safe progression
- Documentation cleanup as clean slate (delete old, start fresh)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Phase 0      │────▶│   Foundation    │────▶│    Execution    │────▶│   Integration   │────▶│     Polish      │
│   (5 epics)     │     │   (2 epics)     │     │   (5 epics)     │     │   (3 epics)     │     │   (4 epics)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
       │                        │                        │                        │                       │
       ▼                        ▼                        ▼                        ▼                       ▼
  Core Ready             Alpha Release           Beta Release            RC Release             GA Release
```

---

## Phase 0: Core Infrastructure

**Goal:** Build the foundation (Signal + Provider + Recording) before multi-provider validation.

**Why This Order:**
1. Signal is the primitive → must exist first
2. Provider interface depends on Signal
3. Recording defines the signal contract → must exist before second provider
4. OpenAI provider validates the abstraction → comes last in Phase 0

**Exit Criteria:**
- [x] Signal type and SignalBus work
- [x] Provider interface defined and documented
- [x] SignalStore (memory + SQLite) works
- [x] Recording/replay works for single provider
- [x] Claude provider migrated to new interface
- [x] OpenAI provider implemented and validated
- [x] Both providers pass same test suite
- [ ] Cross-provider recording/replay works
- [x] Old RecordingStore infrastructure deleted
- ⏳ Signal-native eval system (P0-6) - **Deferred to v0.3.1**

### Quality Gate: Phase 0 → Milestone 1

```bash
# All must pass before proceeding:
bun run test:providers        # Both providers pass same suite
bun run test:recording        # Recording/replay works
bun run test:cross-provider   # Record with Claude, replay with OpenAI signal format
bun run typecheck             # No type errors (old types deleted)
# Note: Signal-native eval (P0-6) deferred to v0.3.1 - vitest provides trajectory assertions
```

### Epics

#### P0-1: Signal Primitives ✅
**Scope:** Define the Signal type and SignalBus.
**Status:** Complete - `packages/signals/` and `packages/core/`

**Deliverables:**
- [x] `Signal<T>` type with source tracking
- [x] `SignalBus` class (emit, subscribe, pattern matching)
- [x] `createSignal()` helper function
- [x] `SignalPattern` type for matching
- [x] Unit tests for SignalBus

**Complexity:** Medium
**Dependencies:** None

---

#### P0-2: Provider Interface ✅
**Scope:** Define the canonical Provider interface.
**Status:** Complete - `packages/core/src/provider.ts`

**Deliverables:**
- [x] `Provider<TInput, TOutput>` interface
- [x] `ProviderInput` / `ProviderOutput` standard types
- [x] `RunContext` with AbortSignal
- [x] Zod schemas for validation
- [x] Documentation of signal contract (PROVIDER_SIGNALS)

**Complexity:** Medium
**Dependencies:** P0-1

---

#### P0-3: SignalStore & Recording ✅
**Scope:** Unified signal storage, snapshots, player API.
**Status:** Complete - `packages/signals/`

**Deliverables:**
- [x] `SignalStore` interface (append, load, checkpoint)
- [x] `MemorySignalStore` implementation
- [ ] `SqliteSignalStore` implementation (deferred - memory-only for now)
- [x] `Snapshot` type (derived from signals)
- [x] `snapshot(signals, atIndex)` function
- [x] `Player` API (step, rewind, goto, gotoNext)
- [x] `Recording` type (signals + metadata)
- [x] Contract tests for stores

**Complexity:** High
**Dependencies:** P0-1

---

#### P0-4: Claude Provider Migration ✅
**Scope:** Migrate Claude to new Provider interface.
**Status:** Complete - `packages/providers/claude/`

**Deliverables:**
- [x] Claude provider implementing Provider interface
- [x] Streaming signals (text:delta, tool:call, etc.)
- [x] Session/resume support
- [x] Recording captures all signals
- [x] Replay injects recorded signals
- [x] Integration tests with real SDK

**Complexity:** Medium
**Dependencies:** P0-2, P0-3

---

#### P0-5: OpenAI Provider Implementation ✅
**Scope:** Implement OpenAI Agents SDK as second provider.
**Status:** Complete - `packages/providers/openai/` (CodexProvider)

**Deliverables:**
- [x] OpenAI provider implementing Provider interface
- [x] Same signal types as Claude (text:delta, tool:call, etc.)
- [x] Session/resume support (if available)
- [x] Tests: swap providers, same harness works
- [ ] Tests: record with Claude, signal format compatible (cross-provider)
- [x] Cross-provider validation (same test suite passes both)

**Complexity:** Medium
**Dependencies:** P0-4

---

#### P0-6: Signal-Native Eval System ⏳ (Deferred to v0.3.1)
**Scope:** Migrate eval system from RecordingStore to SignalStore with signal-native assertions.
**Status:** Deferred - `@open-harness/vitest` covers 80% of use cases

**Deferral Rationale:**
- `@open-harness/vitest` already provides trajectory assertions via `toHaveSignalsInOrder()`
- Signal pattern matching (`toContainSignal`, `toHaveSignalCount`) already exists
- Eval adds value for large-scale dataset testing, but vitest is sufficient for v0.3.0
- Full eval implementation will be P0-1 in v0.3.1

**Original Why:**
- Eval depends on signals/store which already exist (P0-1, P0-3)
- Having eval early lets us validate everything as we build
- Old eval uses `RecordingStore` which we're deleting - need migration path
- Signal-native assertions are MORE powerful than old assertions

**Deliverables:**
- `SignalAssertion` types (patterns, trajectories, snapshots, agent assertions)
- `evaluateSignalAssertion()` evaluator using pattern matching
- `SignalArtifact` type (wraps Recording + finalSnapshot)
- `HarnessFactory` type (replaces WorkflowFactory)
- `runSignalCase()`, `runSignalDataset()`, `runSignalMatrix()` functions
- Signal-based scorers (metrics from `provider:end` signals)
- Adapted comparison (baseline diff, regression detection)
- Adapted reports (Markdown/JSON with signal info)
- DELETE: `packages/stores/recording-store/*` (file, sqlite, testing)
- DELETE: `@internal/core/src/recording/*` (old types)
- Tests: Signal assertions work correctly
- Tests: Trajectory assertions catch out-of-order execution
- Tests: Snapshot assertions inspect mid-execution state

**New Assertion Types:**
```typescript
// Signal pattern assertions
{ type: "signal.contains", pattern: "analysis:complete" }
{ type: "signal.not", pattern: "error:**" }
{ type: "signal.count", pattern: "tool:**", max: 5 }

// Trajectory assertions (ordered)
{ type: "signal.trajectory", patterns: ["harness:start", "...", "harness:end"] }

// Snapshot assertions (state at point)
{ type: "snapshot.at", afterSignal: "analysis:complete", path: "state.result", exists: true }

// Agent assertions
{ type: "agent.activated", agentId: "analyzer" }
{ type: "agent.emitted", agentId: "analyzer", signal: "analysis:complete" }

// Metric assertions (same API, signals internally)
{ type: "metric.cost.max", value: 0.10 }
```

**Complexity:** High
**Dependencies:** P0-3 (SignalStore), P0-5 (both providers for cross-provider eval)

---

## Milestone 1: Agent Foundation

**Goal:** Prove the signal-based model works with a single reactive agent.

**Exit Criteria:**
- [x] Single agent activates on `harness:start`
- [x] Agent emits custom signals
- [x] `when` guard conditions work
- [x] Per-agent provider override works
- [x] Basic tests pass

### Quality Gate: Milestone 1 → Milestone 2

```bash
# All must pass before proceeding:
bun run test:agents           # Single agent tests pass
bun run test:guards           # Guard conditions work
bun run test:provider-override # Per-agent provider works
```

### Epics

#### F1: Basic Reactive Agent ✅
**Scope:** Extend `agent()` with `activateOn`, wire to SignalBus.
**Status:** Complete - `packages/internal/core/src/api/`

**Deliverables:**
- [x] `activateOn` property on agent config
- [x] `emits` property (declarative)
- [x] `when` guard condition
- [x] Per-agent `provider` override
- [x] `runReactive()` for single agent
- [x] Integration test: agent → signal → activation

**Complexity:** Medium
**Dependencies:** P0-5 (all Phase 0 complete)

---

#### F2: Template Expansion ✅
**Scope:** Expand `{{ state.x }}` in agent prompts.
**Status:** Complete - `packages/internal/core/src/api/template.ts`

**Deliverables:**
- [x] Template engine (custom implementation)
- [x] State access in templates
- [x] Signal payload access in templates
- [x] Tests: template expansion timing

**Complexity:** Medium
**Dependencies:** F1

---

## Milestone 2: Execution

**Goal:** Multi-agent workflows with state integration and parallelism.

**Exit Criteria:**
- [x] Multiple agents pass signals to each other
- [x] State changes emit signals automatically
- [x] **Agent outputs update state** (`updates` field + `reducers`)
- [x] Parallel execution works
- [x] `createHarness()` replaces old API
- [x] Quiescence detection works
- [x] Telemetry emits wide events

### Quality Gate: Milestone 2 → Milestone 3

```bash
# All must pass before proceeding:
bun run test:multi-agent      # Multi-agent signal passing works
bun run test:state            # State → signal emission works
bun run test:parallel         # Concurrent execution works
bun run test:harness          # createHarness() API works
bun run test:telemetry        # Wide events emitted correctly
```

### Epics

#### E1: Multi-Agent Signals ✅
**Scope:** Multiple agents, signal passing, causality tracking.
**Status:** Complete - `packages/internal/core/src/api/debug.ts`

**Deliverables:**
- [x] Multiple agents in harness
- [x] Signal passing between agents
- [x] Source tracking (causality chain)
- [x] Debugging view of signal flow (`getCausalityChain`, `buildSignalTree`)
- [x] Tests: two-agent, three-agent workflows

**Complexity:** Medium
**Dependencies:** F2

---

#### E2: State as Signals ✅
**Scope:** Bidirectional state↔signal integration.
**Status:** Complete - state→signal AND signal→state working

**Deliverables:**
- [x] `createReactiveStore` factory
- [x] State proxy that emits `state:X:changed` signals
- [x] State diffing for targeted signals
- [x] Template expansion from store
- [x] Tests: state mutation → signal → agent activation
- [x] **Agent output → state mutation** (`updates` field on agent)
- [x] **Signal reducers** (`reducers` on harness config)
- [x] Examples validate state updates work end-to-end

**Gap Discovered & Fixed:** Agent outputs now update state via two mechanisms:
1. `updates: keyof TState` - Simple mapping of agent output to state field
2. `reducers: Record<string, SignalReducer>` - Complex state updates from signals

**Complexity:** High
**Dependencies:** E1

---

#### E3: Parallel Execution ✅
**Scope:** Concurrent agent activation, quiescence detection.
**Status:** Complete - `packages/internal/core/src/api/run-reactive.ts`

**Deliverables:**
- [x] Multiple agents subscribe to same signal
- [x] Concurrent execution (Promise.all)
- [x] Quiescence detection (no pending signals + no active agents)
- [x] Timeout handling
- [x] Tests: parallel agents, timing verification

**Complexity:** High
**Dependencies:** E1, E2

---

#### E4: Harness API ✅
**Scope:** Full `createHarness()` API.
**Status:** Complete - `packages/internal/core/src/api/create-harness.ts`

**Deliverables:**
- [x] `createHarness()` function (clean API)
- [x] `endWhen` termination condition
- [x] Per-agent provider resolution
- [x] Tests: complex workflows

**Complexity:** Medium
**Dependencies:** E1, E2, E3

---

#### E5: Telemetry (Wide Events) ✅
**Scope:** Observability via wide events derived from signals.
**Status:** Complete - `packages/internal/core/src/api/telemetry.ts`

**Deliverables:**
- [x] `TelemetryConfig` type
- [x] Telemetry subscriber (aggregates signals → wide event)
- [x] Pino integration for wide event emission
- [x] `harness.start` / `harness.complete` / `harness.error` wide events
- [x] `HarnessWideEvent` schema (run_id, duration, tokens, cost, outcome)
- [x] Signal sampling configuration (rate, alwaysOnError)
- [x] Tests: wide event emission, aggregation correctness

**Complexity:** Medium
**Dependencies:** E4

---

## Milestone 3: Integration

**Goal:** Full ecosystem works with signals (reporters, Vitest, providers).

**Exit Criteria:**
- [x] Reporters subscribe to signals
- [x] Vitest helpers work with signal assertions
- [x] All providers emit correct signals
- [x] Existing tests migrate to createHarness

### Quality Gate: Milestone 3 → Milestone 4

```bash
# All must pass before proceeding:
bun run test                  # All tests pass
bun run typecheck             # No type errors
bun run lint                  # No lint errors
bun run test:vitest-matchers  # @open-harness/signals-vitest works
```

### Epics

#### I1: Signal-Based Reporters ✅
**Scope:** Reporters as signal subscribers.
**Status:** Complete - `packages/signals/src/reporter.ts`, `console-reporter.ts`, `metrics-reporter.ts`

**Deliverables:**
- [x] Reporter interface with `subscribe` patterns
- [x] Console reporter migration
- [x] Metrics reporter migration
- [ ] Custom reporter documentation
- [x] Tests: reporter receives signals

**Complexity:** Medium
**Dependencies:** E4

---

#### I2: Vitest Integration (@open-harness/vitest) ✅
**Scope:** Test helpers for signal assertions, player API, metrics.
**Status:** Complete - All core matchers implemented in `packages/open-harness/vitest/src/matchers.ts`

**Deliverables:**
- [x] `@open-harness/vitest` package (renamed from signals-vitest)
- [x] `toContainSignal(pattern)` matcher (with payload matching support)
- [x] `toHaveSignalCount(pattern, count)` matcher
- [x] `toHaveSignalsInOrder(patterns[])` matcher (trajectory/sequence assertions)
- [x] `toHaveTokensUnder(max)` matcher
- [x] `toCostUnder(maxDollars)` matcher
- [x] `toHaveLatencyUnder(maxMs)` matcher
- [ ] `toHaveMessages(count)` snapshot matcher (deferred - low priority)
- [ ] `toHaveToolCalls(count)` snapshot matcher (deferred - low priority)
- [x] `createHarness()` helper (re-exported from core)
- [x] `createPlayer(signals)` helper (re-exported from signals)
- [ ] `loadRecording(path)` helper (nice-to-have)
- [x] Example test suite (`examples/testing-signals/workflow.test.ts`)
- [x] Documentation (`examples/testing-signals/README.md`)

**Complexity:** Medium
**Dependencies:** I1

---

#### I3: Provider Signal Schema ✅
**Scope:** Consistent signal schema for all providers.
**Status:** Complete - `packages/core/src/provider.ts` (PROVIDER_SIGNALS)

**Deliverables:**
- [x] Provider signal schema documented (PROVIDER_SIGNALS constant)
- [x] Claude provider emits consistent signals
- [x] OpenAI provider emits same signals
- [x] Tests: provider-agnostic signal assertions

**Complexity:** Low
**Dependencies:** E4

---

## Milestone 4: Polish

**Goal:** Production-ready with docs, examples, and validation.

**Exit Criteria:**
- [x] Trading agent example complete
- [x] All examples updated to v0.3.0 API
- [x] External docs completely rewritten (clean slate)
- [ ] Internal READMEs in all packages
- [x] All tests pass
- [x] No known bugs
- [x] Old recording-store deleted
- [x] Old run-store deleted
- [x] Old node/graph/trait code deleted

### Quality Gate: Milestone 4 → Release

```bash
# All must pass before release:
bun run test                  # All tests pass
bun run typecheck             # No type errors
bun run lint                  # No lint errors
bun run build                 # Build succeeds
bun run docs:build            # Docs site builds
# Manual: Trading example walkthrough works end-to-end
```

### Epics

#### P1: Examples Update ✅
**Scope:** Update all examples to v0.3.0 API.
**Status:** Complete - All 5 examples updated, validated, and documented

**Deliverables:**
- [x] Trading agent example (flagship, 5 agents with parallel execution)
- [x] Simple agent example (hello world with `updates` field)
- [x] Multi-provider example (Claude + OpenAI) - needs Codex API access
- [x] Recording/replay example (record, replay, Player VCR)
- [x] Testing example with @open-harness/vitest (`examples/testing-signals/`)
- [x] All examples have README with walkthrough

**Validated:**
- Signal chaining between agents ✓
- Guard conditions (`when`) ✓
- State updates via `updates` and `reducers` ✓
- `endWhen` termination ✓
- Parallel execution ✓
- Recording/replay without provider calls ✓
- Vitest signal matchers (`toContainSignal`, `toHaveSignalsInOrder`, etc.) ✓

**Complexity:** High
**Dependencies:** All integration epics

---

#### P2: Documentation Cleanup (Clean Slate) ✅
**Scope:** Delete old docs, rewrite from scratch.
**Status:** Complete

**Deliverables:**
- [x] DELETE: All v0.2.0 docs (020, 030 content)
- [x] DELETE: Out-of-date API references
- [x] One unified docs site (not versioned sections)
- [x] Architecture overview (signal-based)
- [x] Getting started with createHarness
- [x] Signal reference
- [x] Provider implementation guide (custom-agents.mdx → Custom Providers)
- [x] Testing guide (@open-harness/vitest) - 4 pages in guides/testing/
- ⏳ Eval guide (@open-harness/eval) - **Deferred to v0.3.1**
- [x] API reference (runtime.mdx, events.mdx, Signal type)
- [x] Migration guide from v0.2.0 (learn/migration.mdx)

**Complexity:** High
**Dependencies:** P1

---

#### P3: Internal Documentation ✅
**Scope:** README in every major folder, up-to-date.
**Status:** Complete - All packages have READMEs, architecture diagrams added

**Deliverables:**
- [x] `packages/core/README.md` (@signals/core primitives)
- [x] `packages/signals/README.md` (already existed)
- [x] `packages/providers/claude/README.md` (ClaudeProvider)
- [x] `packages/providers/openai/README.md` (CodexProvider)
- [x] `packages/open-harness/vitest/README.md` (matchers, reporter)
- [x] `packages/open-harness/*/README.md` (stub READMEs for placeholders)
- [x] `packages/internal/core/README.md` (API, debug, template, telemetry)
- [x] `packages/internal/client/README.md` (HTTPSSEClient, transports)
- [x] `examples/*/README.md` (all 5 examples have READMEs)
- [x] Architecture diagrams (5 Mermaid diagrams in ARCHITECTURE.md)

**Complexity:** Medium
**Dependencies:** P1

---

#### P4: Cleanup & Deletion ✅
**Scope:** Remove old code and packages.
**Status:** Complete - All legacy code deleted, typecheck passes

**Deliverables:**
- [x] DELETE: `packages/stores/run-store/*`
- [x] DELETE: Old provider abstractions (ProviderTrait, adapter, toNodeDefinition)
- [x] DELETE: Graph/node/edge code (NodeTypeDefinition, NodeRegistry, NodeRunContext)
- [x] DELETE: Old event types (StreamEvent, RuntimeEvent)
- [x] DELETE: Old eval types (WorkflowFactory, NodeRegistry-based)
- [x] DELETE: `packages/stores/recording-store/*` (file, sqlite, testing)
- [x] DELETE: `@internal/core/src/recording/*`
- [x] DELETE: `@internal/core/src/eval/*`
- [x] DELETE: `@internal/core/src/nodes/*` (NodeTypeDefinition, NodeRegistry)
- [x] DELETE: `@internal/core/src/providers/*` (ProviderTrait, adapter)
- [x] DELETE: `@internal/core/src/runtime/*` (old executor, compiler)
- [x] DELETE: `@internal/core/src/builtins/*` (echo, constant)
- [x] DELETE: `@internal/server/src/providers/*` (old claude, template)
- [x] DELETE: `@internal/server/src/transports/*` (local, websocket, http-sse)
- [x] DELETE: `@internal/server/src/harness/*`
- [x] DELETE: `@internal/server/src/api/hono/{chat,commands,events}`
- [x] DELETE: `@open-harness/testing` old utilities (MockRuntime, runtimeContract)
- [x] DELETE: `@open-harness/react` old hooks (useRuntime, useHarness)
- [x] Verify no dead imports (typecheck passes)
- [ ] Verify bundle size reduced

**Complexity:** Medium
**Dependencies:** P1, P2, P3 (P0-6 deferred to v0.3.1)

---

## Dependency Graph

```
Phase 0: Core Infrastructure
─────────────────────────────
P0-1 (Signal Primitives) ✅
 │
 ├──▶ P0-2 (Provider Interface) ✅
 │     │
 │     └──▶ P0-4 (Claude Provider) ✅
 │           │
 │           └──▶ P0-5 (OpenAI Provider) ✅ ──▶ [GATE: Phase 0 Complete]
 │
 └──▶ P0-3 (SignalStore & Recording) ✅
       │
       └──▶ P0-4 (Claude Provider) ✅

 P0-6 (Signal-Native Eval) ⏳ ──▶ Deferred to v0.3.1


Milestone 1: Agent Foundation
─────────────────────────────
F1 (Basic Reactive Agent)
 │
 └──▶ F2 (Template Expansion) ──▶ [GATE: Milestone 1 Complete]


Milestone 2: Execution
──────────────────────
E1 (Multi-Agent Signals)
 │
 ├──▶ E2 (State as Signals)
 │     │
 │     └──▶ E3 (Parallel Execution)
 │           │
 │           └──▶ E4 (Harness API)
 │                 │
 │                 └──▶ E5 (Telemetry) ──▶ [GATE: Milestone 2 Complete]


Milestone 3: Integration
────────────────────────
I1 (Signal-Based Reporters)
 │
 └──▶ I2 (Vitest Integration)
       │
       └──▶ I3 (Provider Signal Schema) ──▶ [GATE: Milestone 3 Complete]


Milestone 4: Polish
───────────────────
P1 (Examples Update)
 │
 ├──▶ P2 (Documentation Cleanup)
 │
 ├──▶ P3 (Internal Documentation)
 │
 └──▶ P4 (Cleanup & Deletion) ──▶ [GATE: Release]
```

---

## Epic Summary Table

| ID | Epic | Milestone | Complexity | Status |
|----|------|-----------|------------|--------|
| P0-1 | Signal Primitives | Phase 0 | Medium | ✅ Done |
| P0-2 | Provider Interface | Phase 0 | Medium | ✅ Done |
| P0-3 | SignalStore & Recording | Phase 0 | High | ✅ Done |
| P0-4 | Claude Provider Migration | Phase 0 | Medium | ✅ Done |
| P0-5 | OpenAI Provider | Phase 0 | Medium | ✅ Done |
| P0-6 | Signal-Native Eval | Phase 0 | High | ⏳ Deferred to v0.3.1 |
| F1 | Basic Reactive Agent | Foundation | Medium | ✅ Done |
| F2 | Template Expansion | Foundation | Medium | ✅ Done |
| E1 | Multi-Agent Signals | Execution | Medium | ✅ Done |
| E2 | State as Signals | Execution | High | ✅ Done |
| E3 | Parallel Execution | Execution | High | ✅ Done |
| E4 | Harness API | Execution | Medium | ✅ Done |
| E5 | Telemetry (Wide Events) | Execution | Medium | ✅ Done |
| I1 | Signal-Based Reporters | Integration | Medium | ✅ Done |
| I2 | Vitest Integration | Integration | Medium | ✅ Done |
| I3 | Provider Signal Schema | Integration | Low | ✅ Done |
| P1 | Examples Update | Polish | High | ✅ Done |
| P2 | Documentation Cleanup | Polish | High | ✅ Done |
| P3 | Internal Documentation | Polish | Medium | ✅ Done |
| P4 | Cleanup & Deletion | Polish | Medium | ✅ Done |

**Progress: 19/20 epics complete, 0 partial, 1 not started**

---

## Next Steps

**Completed:**
- [x] Phase 0: Core Infrastructure (P0-1 through P0-5)
- [x] Milestone 1: Agent Foundation (F1, F2)
- [x] Milestone 2: Execution (E1-E5)
- [x] Milestone 3: Integration (I1, I2, I3) ✅ **All complete!**
- [x] P1: Examples Update ✅ **All 5 examples complete with READMEs**
- [x] I2: Vitest Integration ✅ **All core matchers implemented**
- [x] P4: Cleanup & Deletion ✅ **All legacy code deleted**
- [x] P3: Internal Documentation ✅ **All package READMEs created**

**Remaining Work:**

None for v0.3.0 - P0-6 (Signal-Native Eval) deferred to v0.3.1.
`@open-harness/vitest` provides trajectory assertions (`toHaveSignalsInOrder`) for v0.3.0.

**Recently Completed:**
- **P2: Documentation Cleanup** ✅ - Clean slate rewrite complete (all docs except eval guide)
- **P5: v0.3.0 Landing** 🚀 - Package structure cleanup, eval deferral, quality sweep

---

## P0-6: Signal-Native Eval System (Detailed)

> **⏳ DEFERRED TO v0.3.1**: This section is preserved for future reference. For v0.3.0, use `@open-harness/vitest` which provides trajectory assertions (`toHaveSignalsInOrder`), signal pattern matching (`toContainSignal`, `toHaveSignalCount`), and snapshot testing.

**Full Specification:** `specs/p0-6-signal-native-eval/spec.md`

### Why Signal-Based Eval Changes Everything

Traditional eval systems see: `Input → [black box] → Output`

Open Harness sees: `Input → harness:start → agent:activated → provider:start → text:delta → provider:end → state:changed → agent:activated → ... → harness:end`

This enables assertions competitors **cannot do**:
- **Trajectory assertions** — Did agents execute in the right order?
- **Snapshot assertions** — What was the state mid-execution?
- **Causality assertions** — Which agent triggered which action?
- **Tool assertions** — Did the coding agent use the right tools?

### Core Design: Assertions as Data

Instead of procedural tests, assertions are **declarative YAML**:

```yaml
# evals/code-review-agent.yaml
cases:
  - id: sql-injection
    name: Detects SQL injection vulnerability
    input:
      code: |
        const query = `SELECT * FROM users WHERE id = ${userId}`;
    assertions:
      # Trajectory: reviewer must complete before fixer activates
      - type: signal.trajectory
        patterns:
          - harness:start
          - { pattern: agent:activated, payload: { agent: reviewer } }
          - review:complete
          - { pattern: agent:activated, payload: { agent: fixer } }
          - fix:proposed
          - harness:end

      # Snapshot: check state mid-execution
      - type: snapshot.at
        afterSignal: review:complete
        path: severity
        value: critical

      # Tool usage (for coding agents)
      - type: tool.called
        name: Edit

      # Output validation
      - type: output.matches
        regex: "SQL.*injection|parameterized"
        flags: i
```

### Key Assertion Types

| Category | Assertions | Use Case |
|----------|------------|----------|
| **Signal** | contains, not, count, trajectory, first, last | Verify execution flow |
| **Snapshot** | at, final | Mid-execution state inspection |
| **Agent** | activated, completed, causedBy, emitted, skipped | Agent behavior |
| **Metric** | latency, cost, tokens, activations | Performance bounds |
| **Output** | contains, matches, json, length | Final output validation |
| **Tool** | called, notCalled, calledWith, sequence | Tool usage for coding agents |
| **Compose** | all, any, not | Combine assertions |
| **LLM** | judge | LLM-as-Judge quality scoring |

### Example Domains

**Code Review Agent** (two-agent: reviewer → fixer)
- SQL injection detection
- XSS vulnerability detection
- Code quality issues
- False positive prevention (clean code)

**Code Generation Agent** (four-agent: planner → coder → tester → reviewer)
- Algorithm implementation (fibonacci, binary search)
- API endpoint generation
- Error handling for impossible tasks
- Tool usage validation

**Refactoring Agent** (multi-file operations)
- Rename function across files
- Extract interface from class
- Move code to separate file

**Debugging Agent** (diagnose → fix)
- Null pointer errors
- Async test timeouts
- Import/export mismatches

### API Surface

```typescript
// Evaluate single assertion
evaluateAssertion(assertion, signals, result): AssertionResult

// Run single case
runCase(factory, agents, evalCase, options): CaseResult

// Run dataset (batch)
runDataset(factory, agents, dataset, options): DatasetResult

// Matrix evaluation (variants × cases)
runMatrix(variants, dataset, options): MatrixResult

// Compare runs (regression detection)
compare(baseline, candidate, options): Comparison

// Reports
generateMarkdownReport(result): string
generateJSONReport(result): object

// Persistence
loadDataset(path): EvalDataset
saveResult(result, path): void
```

### Implementation Phases

**Phase 1: Core (MVP)**
- [ ] SignalAssertion types (all of them)
- [ ] evaluateAssertion() function
- [ ] runCase() and runDataset()
- [ ] YAML loader with Zod validation
- [ ] Basic markdown report
- [ ] Unit tests for all assertion types

**Phase 2: Advanced**
- [ ] Tool assertions (for coding agents)
- [ ] LLM-as-Judge assertion
- [ ] runMatrix() function
- [ ] compare() with regression detection
- [ ] Enhanced markdown/JSON reports

**Phase 3: Polish**
- [ ] CLI tool (`bun run eval`)
- [ ] CI integration guide
- [ ] Example datasets (code review, code gen, refactoring, debugging)
- [ ] Documentation

### Package Structure

```
packages/eval/                    # @open-harness/eval
├── src/
│   ├── assertions/
│   │   ├── types.ts             # SignalAssertion union
│   │   ├── signal.ts            # contains, trajectory, etc.
│   │   ├── snapshot.ts          # at, final
│   │   ├── agent.ts             # activated, completed, etc.
│   │   ├── metric.ts            # latency, cost, tokens
│   │   ├── output.ts            # contains, matches, json
│   │   ├── tool.ts              # called, sequence (coding agents)
│   │   ├── llm.ts               # judge
│   │   ├── compose.ts           # all, any, not
│   │   └── evaluate.ts          # evaluateAssertion()
│   ├── runners/
│   │   ├── case.ts              # runCase()
│   │   ├── dataset.ts           # runDataset()
│   │   └── matrix.ts            # runMatrix()
│   ├── comparison/
│   │   └── compare.ts           # compare(), Regression types
│   ├── reports/
│   │   ├── markdown.ts
│   │   └── json.ts
│   ├── loader/
│   │   └── yaml.ts              # loadDataset()
│   └── index.ts
└── package.json
```

---

## P2: Documentation Cleanup

**Status:** ✅ Complete

Clean slate rewrite of external documentation:

- [x] DELETE: All v0.2.0 docs (020, 030 content)
- [x] DELETE: Out-of-date API references
- [x] One unified docs site (not versioned sections)
- [x] Architecture overview (signal-based) - concepts/architecture.mdx
- [x] Getting started with createHarness - learn/quickstart.mdx
- [x] Signal reference - concepts/event-system.mdx, reference/api/events.mdx
- [x] Provider implementation guide - guides/agents/custom-agents.mdx (Custom Providers)
- [x] Testing guide (@open-harness/vitest) - guides/testing/* (4 pages)
- ⏳ Eval guide (@open-harness/eval) - **Deferred to v0.3.1**
- [x] API reference - reference/api/runtime.mdx, reference/types/runtime-event.mdx
- [x] Migration guide from v0.2.0 - learn/migration.mdx

**Recently Completed (Audit 2025-01-10):**

- **I2: Vitest Integration** ✅ - All core matchers complete
  - `toContainSignal(pattern)` with payload matching
  - `toHaveSignalCount(pattern, count)`
  - `toHaveSignalsInOrder(patterns[])` for trajectory assertions
  - `toHaveLatencyUnder()`, `toCostUnder()`, `toHaveTokensUnder()`
  - Example test suite: `examples/testing-signals/workflow.test.ts`

- **P1: Examples Update** ✅ - All 5 examples complete
  - simple-reactive: `updates` field, signal chaining
  - trading-agent: 5 agents, parallel execution, `reducers` for JSON
  - recording-replay: record, replay, Player VCR controls
  - multi-provider: Claude + CodexProvider architecture
  - testing-signals: Comprehensive vitest matcher examples

- **P4: Cleanup & Deletion** ✅ - All legacy code deleted
  - Deleted `@internal/core/src/{nodes,providers,runtime,builtins,eval,recording}`
  - Deleted `@internal/server/src/{providers,transports,harness}` and old API routes
  - Deleted `@open-harness/{testing,react}` old utilities
  - Typecheck passes (14/14 packages) with clean signal-based architecture
