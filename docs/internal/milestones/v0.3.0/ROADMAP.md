# Open Harness v0.3.0 Roadmap

**Status:** Planning
**Start Date:** TBD (after v0.2.0 ships)
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
- [ ] Signal type and SignalBus work
- [ ] Provider interface defined and documented
- [ ] SignalStore (memory + SQLite) works
- [ ] Recording/replay works for single provider
- [ ] Claude provider migrated to new interface
- [ ] OpenAI provider implemented and validated
- [ ] Both providers pass same test suite
- [ ] Cross-provider recording/replay works

### Quality Gate: Phase 0 → Milestone 1

```bash
# All must pass before proceeding:
bun run test:providers        # Both providers pass same suite
bun run test:recording        # Recording/replay works
bun run test:cross-provider   # Record with Claude, replay with OpenAI signal format
```

### Epics

#### P0-1: Signal Primitives
**Scope:** Define the Signal type and SignalBus.

**Deliverables:**
- `Signal<T>` type with source tracking
- `SignalBus` class (emit, subscribe, pattern matching)
- `signal()` helper function
- `SignalPattern` type for matching
- Unit tests for SignalBus

**Complexity:** Medium
**Dependencies:** None

---

#### P0-2: Provider Interface
**Scope:** Define the canonical Provider interface.

**Deliverables:**
- `Provider<TInput, TOutput>` interface
- `ProviderInput` / `ProviderOutput` standard types
- `RunContext` with AbortSignal
- Zod schemas for validation
- Documentation of signal contract (what signals providers must emit)

**Complexity:** Medium
**Dependencies:** P0-1

---

#### P0-3: SignalStore & Recording
**Scope:** Unified signal storage, snapshots, player API.

**Deliverables:**
- `SignalStore` interface (append, load, checkpoint)
- `MemorySignalStore` implementation
- `SqliteSignalStore` implementation
- `Snapshot` type (derived from signals)
- `snapshot(signals, atIndex)` function
- `Player` API (step, rewind, goto, gotoNext)
- `Recording` type (signals + metadata)
- Contract tests for stores

**Complexity:** High
**Dependencies:** P0-1

---

#### P0-4: Claude Provider Migration
**Scope:** Migrate Claude to new Provider interface.

**Deliverables:**
- Claude provider implementing Provider interface
- Streaming signals (text:delta, tool:call, etc.)
- Session/resume support
- Recording captures all signals
- Replay injects recorded signals
- Integration tests with real SDK

**Complexity:** Medium
**Dependencies:** P0-2, P0-3

---

#### P0-5: OpenAI Provider Implementation
**Scope:** Implement OpenAI Agents SDK as second provider.

**Deliverables:**
- OpenAI provider implementing Provider interface
- Same signal types as Claude (text:delta, tool:call, etc.)
- Session/resume support (if available)
- Tests: swap providers, same harness works
- Tests: record with Claude, signal format compatible
- Cross-provider validation (same test suite passes both)

**Complexity:** Medium
**Dependencies:** P0-4

---

## Milestone 1: Agent Foundation

**Goal:** Prove the signal-based model works with a single reactive agent.

**Exit Criteria:**
- [ ] Single agent activates on `harness:start`
- [ ] Agent emits custom signals
- [ ] `when` guard conditions work
- [ ] Per-agent provider override works
- [ ] Basic tests pass

### Quality Gate: Milestone 1 → Milestone 2

```bash
# All must pass before proceeding:
bun run test:agents           # Single agent tests pass
bun run test:guards           # Guard conditions work
bun run test:provider-override # Per-agent provider works
```

### Epics

#### F1: Basic Reactive Agent
**Scope:** Extend `agent()` with `activateOn`, wire to SignalBus.

**Deliverables:**
- `activateOn` property on agent config
- `emits` property (declarative)
- `when` guard condition
- Per-agent `provider` override
- `runReactive()` for single agent
- Integration test: agent → signal → activation

**Complexity:** Medium
**Dependencies:** P0-5 (all Phase 0 complete)

---

#### F2: Template Expansion
**Scope:** Expand `{{ state.x }}` in agent prompts.

**Deliverables:**
- Template engine (Handlebars or custom)
- State access in templates
- Signal payload access in templates
- Tests: template expansion timing

**Complexity:** Medium
**Dependencies:** F1

---

## Milestone 2: Execution

**Goal:** Multi-agent workflows with state integration and parallelism.

**Exit Criteria:**
- [ ] Multiple agents pass signals to each other
- [ ] State changes emit signals automatically
- [ ] Parallel execution works
- [ ] `createHarness()` replaces old API
- [ ] Quiescence detection works
- [ ] Telemetry emits wide events

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

#### E1: Multi-Agent Signals
**Scope:** Multiple agents, signal passing, causality tracking.

**Deliverables:**
- Multiple agents in harness
- Signal passing between agents
- Source tracking (causality chain)
- Debugging view of signal flow
- Tests: two-agent, three-agent workflows

**Complexity:** Medium
**Dependencies:** F2, F3

---

#### E2: State as Signals
**Scope:** Zustand integration, auto-emit on state change.

**Deliverables:**
- `createReactiveStore` factory
- State proxy that emits `state:X:changed` signals
- State diffing for targeted signals
- Template expansion from store
- Tests: state mutation → signal → agent activation

**Complexity:** High
**Dependencies:** E1

---

#### E3: Parallel Execution
**Scope:** Concurrent agent activation, quiescence detection.

**Deliverables:**
- Multiple agents subscribe to same signal
- Concurrent execution (Promise.all)
- Quiescence detection (no pending signals + no active agents)
- Timeout handling
- Tests: parallel agents, timing verification

**Complexity:** High
**Dependencies:** E1, E2

---

#### E4: Harness API
**Scope:** Full `createHarness()` API.

**Deliverables:**
- `createHarness()` function (clean API)
- `endWhen` termination condition
- Per-agent provider resolution
- Tests: complex workflows

**Complexity:** Medium
**Dependencies:** E1, E2, E3

---

#### E5: Telemetry (Wide Events)
**Scope:** Observability via wide events derived from signals.

**Deliverables:**
- `TelemetryConfig` type
- Telemetry subscriber (aggregates signals → wide event)
- Pino integration for wide event emission
- `harness.start` / `harness.complete` / `harness.error` wide events
- `HarnessWideEvent` schema (run_id, duration, tokens, cost, outcome)
- Signal sampling configuration (rate, alwaysOnError)
- Tests: wide event emission, aggregation correctness

**Complexity:** Medium
**Dependencies:** E4

---

## Milestone 3: Integration

**Goal:** Full ecosystem works with signals (reporters, Vitest, providers).

**Exit Criteria:**
- [ ] Reporters subscribe to signals
- [ ] Vitest helpers work with signal assertions
- [ ] All providers emit correct signals
- [ ] Existing tests migrate to createHarness

### Quality Gate: Milestone 3 → Milestone 4

```bash
# All must pass before proceeding:
bun run test                  # All tests pass
bun run typecheck             # No type errors
bun run lint                  # No lint errors
bun run test:vitest-matchers  # @open-harness/signals-vitest works
```

### Epics

#### I1: Signal-Based Reporters
**Scope:** Reporters as signal subscribers.

**Deliverables:**
- Reporter interface with `subscribe` patterns
- Console reporter migration
- Metrics reporter migration
- Custom reporter documentation
- Tests: reporter receives signals

**Complexity:** Medium
**Dependencies:** E4

---

#### I2: Vitest Integration (@open-harness/signals-vitest)
**Scope:** Test helpers for signal assertions, player API, metrics.

**Deliverables:**
- `@open-harness/signals-vitest` package
- `toContainSignal(pattern)` matcher
- `toMatchSignal(pattern)` matcher
- `toMatchTrajectory(patterns[])` matcher (sequence assertions)
- `toHaveTokensUnder(max)` matcher
- `toCostUnder(maxDollars)` matcher
- `toHaveLatencyUnder(maxMs)` matcher
- `toHaveMessages(count)` snapshot matcher
- `toHaveToolCalls(count)` snapshot matcher
- `createTestHarness()` helper (in-memory, no persistence)
- `createPlayer(signals)` helper
- `loadRecording(path)` helper
- Example test suite
- Documentation

**Complexity:** Medium
**Dependencies:** I1

---

#### I3: Provider Signal Schema
**Scope:** Consistent signal schema for all providers.

**Deliverables:**
- Provider signal schema documented
- Claude provider emits consistent signals
- OpenAI provider emits same signals
- Tests: provider-agnostic signal assertions

**Complexity:** Low
**Dependencies:** E4

---

## Milestone 4: Polish

**Goal:** Production-ready with docs, examples, and validation.

**Exit Criteria:**
- [ ] Trading agent example complete
- [ ] All examples updated to v0.3.0 API
- [ ] External docs completely rewritten (clean slate)
- [ ] Internal READMEs in all folders
- [ ] All tests pass
- [ ] No known bugs
- [ ] Old stores deleted (run-store, recording-store)

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

#### P1: Examples Update
**Scope:** Update all examples to v0.3.0 API.

**Deliverables:**
- Trading agent example (flagship, 4+ agents)
- Simple agent example (hello world)
- Multi-provider example (Claude + OpenAI)
- Recording/replay example
- Testing example with @open-harness/signals-vitest
- All examples have README with walkthrough

**Complexity:** High
**Dependencies:** All integration epics

---

#### P2: Documentation Cleanup (Clean Slate)
**Scope:** Delete old docs, rewrite from scratch.

**Deliverables:**
- DELETE: All v0.2.0 docs (020, 030 content)
- DELETE: Out-of-date API references
- One unified docs site (not versioned sections)
- Architecture overview (signal-based)
- Getting started with createHarness
- Signal reference
- Provider implementation guide
- Testing guide (@open-harness/signals-vitest)
- API reference (generated from code)
- Migration guide from v0.2.0

**Complexity:** High
**Dependencies:** P1

---

#### P3: Internal Documentation
**Scope:** README in every major folder, up-to-date.

**Deliverables:**
- `packages/core/README.md`
- `packages/signals/README.md`
- `packages/harness/README.md`
- `packages/providers/*/README.md`
- `packages/stores/*/README.md`
- `packages/testing/vitest/README.md`
- `examples/*/README.md`
- Architecture diagrams

**Complexity:** Medium
**Dependencies:** P1

---

#### P4: Cleanup & Deletion
**Scope:** Remove old code and packages.

**Deliverables:**
- DELETE: `packages/stores/run-store/*`
- DELETE: `packages/stores/recording-store/*`
- DELETE: Old provider abstractions (trait, adapter)
- DELETE: Graph/node/edge code
- DELETE: Old event types
- Verify no dead imports
- Verify bundle size reduced

**Complexity:** Medium
**Dependencies:** P1, P2, P3

---

## Dependency Graph

```
Phase 0: Core Infrastructure
─────────────────────────────
P0-1 (Signal Primitives)
 │
 ├──▶ P0-2 (Provider Interface)
 │     │
 │     └──▶ P0-4 (Claude Provider)
 │           │
 │           └──▶ P0-5 (OpenAI Provider) ──▶ [GATE: Phase 0 Complete]
 │
 └──▶ P0-3 (SignalStore & Recording)
       │
       └──▶ P0-4 (Claude Provider)


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
| P0-1 | Signal Primitives | Phase 0 | Medium | Planned |
| P0-2 | Provider Interface | Phase 0 | Medium | Planned |
| P0-3 | SignalStore & Recording | Phase 0 | High | Planned |
| P0-4 | Claude Provider Migration | Phase 0 | Medium | Planned |
| P0-5 | OpenAI Provider | Phase 0 | Medium | Planned |
| F1 | Basic Reactive Agent | Foundation | Medium | Planned |
| F2 | Template Expansion | Foundation | Medium | Planned |
| E1 | Multi-Agent Signals | Execution | Medium | Planned |
| E2 | State as Signals | Execution | High | Planned |
| E3 | Parallel Execution | Execution | High | Planned |
| E4 | Harness API | Execution | Medium | Planned |
| E5 | Telemetry (Wide Events) | Execution | Medium | Planned |
| I1 | Signal-Based Reporters | Integration | Medium | Planned |
| I2 | Vitest Integration | Integration | Medium | Planned |
| I3 | Provider Signal Schema | Integration | Low | Planned |
| P1 | Examples Update | Polish | High | Planned |
| P2 | Documentation Cleanup | Polish | High | Planned |
| P3 | Internal Documentation | Polish | Medium | Planned |
| P4 | Cleanup & Deletion | Polish | Medium | Planned |

**Total: 19 epics across 5 milestones**

---

## Next Steps

1. [ ] Ship v0.2.0 (current work)
2. [ ] Review and finalize architecture decisions (Q1, Q2, Q3)
3. [ ] Create GitHub milestones and epics
4. [ ] Begin Phase 0:
   - [ ] P0-1: Signal Primitives
   - [ ] P0-2: Provider Interface
   - [ ] P0-3: SignalStore & Recording
   - [ ] P0-4: Claude Provider Migration
   - [ ] P0-5: OpenAI Provider
5. [ ] Pass Phase 0 quality gate
6. [ ] Begin Milestone 1: Agent Foundation
