# Open Harness v0.3.0 Roadmap

**Status:** Planning
**Start Date:** TBD (after v0.2.0 ships)
**Target:** TBD

---

## Overview

v0.3.0 is organized into 4 milestones with 14 epics total. Each milestone has clear exit criteria and delivers working software.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Foundation    │────▶│    Execution    │────▶│   Integration   │────▶│     Polish      │
│   (3 epics)     │     │   (4 epics)     │     │   (3 epics)     │     │   (4 epics)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
       │                        │                        │                       │
       ▼                        ▼                        ▼                       ▼
  Alpha Release           Beta Release            RC Release             GA Release
```

---

## Milestone 1: Foundation

**Goal:** Prove the signal-based model works with a single reactive agent.

**Exit Criteria:**
- [ ] SignalBus dispatches signals correctly
- [ ] Single agent activates on `flow:start`
- [ ] Agent emits custom signals
- [ ] Signal recording captures full trace
- [ ] Replay works from signal recording
- [ ] Basic tests pass

### Epics

#### F1: Signal Primitives
**Scope:** Define `Signal` type, `SignalBus` implementation, pattern matching.

**Deliverables:**
- `Signal<T>` type with causality chain
- `SignalBus` class (emit, subscribe, pattern matching)
- `signal()` helper function
- Unit tests for SignalBus

**Complexity:** Medium
**Dependencies:** None

---

#### F2: Basic Reactive Agent
**Scope:** Extend `agent()` with `activateOn`, wire to SignalBus.

**Deliverables:**
- `activateOn` property on agent config
- `emits` property (declarative)
- `when` guard condition
- `runReactive()` for single agent
- Integration test: agent → signal → activation

**Complexity:** Medium
**Dependencies:** F1

---

#### F3: Signal Recording
**Scope:** Record signals instead of snapshots, replay from signal log.

**Deliverables:**
- `SignalRecording` type
- Recording captures all signals
- `provider:request`/`provider:response` pairs
- Replay injects responses at request time
- Fixture tests with signal recordings

**Complexity:** High
**Dependencies:** F1, F2

---

## Milestone 2: Execution

**Goal:** Multi-agent workflows with state integration and parallelism.

**Exit Criteria:**
- [ ] Multiple agents pass signals to each other
- [ ] State changes emit signals automatically
- [ ] Parallel execution works
- [ ] `reactive()` replaces `harness()` for tests
- [ ] Quiescence detection works

### Epics

#### E1: Multi-Agent Signals
**Scope:** Multiple agents, signal passing, causality tracking.

**Deliverables:**
- Multiple agents in `reactive()` graph
- Signal passing between agents
- Causality chain populated correctly
- Debugging view of signal flow
- Tests: two-agent, three-agent workflows

**Complexity:** Medium
**Dependencies:** F2, F3

---

#### E2: State as Signals
**Scope:** Zustand integration, auto-emit on state change.

**Deliverables:**
- `createState` factory in reactive config
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
- Quiescence detection (no pending signals + no active nodes)
- Timeout handling
- Tests: parallel agents, timing verification

**Complexity:** High
**Dependencies:** E1, E2

---

#### E4: Reactive Graph API
**Scope:** Full `reactive()` API, replace `harness()`.

**Deliverables:**
- `reactive()` function (clean API)
- `endWhen` termination condition
- Optional explicit signal wiring
- Migration from `harness()` (adapter)
- Tests: complex workflows

**Complexity:** Medium
**Dependencies:** E1, E2, E3

---

## Milestone 3: Integration

**Goal:** Full ecosystem works with signals (reporters, Vitest, providers).

**Exit Criteria:**
- [ ] Reporters subscribe to signals
- [ ] Vitest helpers work with signal assertions
- [ ] All providers emit correct signals
- [ ] Existing tests migrate to reactive

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

#### I2: Vitest Integration
**Scope:** Test helpers for signal assertions.

**Deliverables:**
- `expect(result.signals).toContainSignal()`
- `fixtures()` helper for reactive
- Matcher for signal causality
- Example test suite
- Documentation

**Complexity:** Medium
**Dependencies:** I1

---

#### I3: Provider Signal Emission
**Scope:** All providers emit consistent signals.

**Deliverables:**
- Anthropic provider emits signals
- (Future) OpenAI provider emits signals
- Signal schema for provider events
- Tests: provider signal verification

**Complexity:** Low
**Dependencies:** E4

---

## Milestone 4: Polish

**Goal:** Production-ready with docs, examples, and migration path.

**Exit Criteria:**
- [ ] Trading agent example complete
- [ ] External docs updated
- [ ] Internal READMEs in all folders
- [ ] Migration guide published
- [ ] All tests pass
- [ ] No known bugs

### Epics

#### P1: Trading Agent Example
**Scope:** Flagship example demonstrating full signal-based workflow.

**Deliverables:**
- Complete trading bot with 4+ agents
- Zustand state management
- Parallel execution (analyst + risk)
- Signal recording/replay
- Full test suite
- README with walkthrough

**Complexity:** High
**Dependencies:** All execution epics

---

#### P2: External Documentation
**Scope:** User-facing docs for new paradigm.

**Deliverables:**
- Architecture overview (simplified)
- Getting started with reactive
- Signal reference
- Migration guide from v0.2.0
- API reference updates

**Complexity:** Medium
**Dependencies:** P1

---

#### P3: Internal Documentation
**Scope:** README in every major folder, up-to-date.

**Deliverables:**
- `packages/internal/core/README.md`
- `packages/internal/server/README.md`
- `packages/open-harness/*/README.md`
- `examples/*/README.md`
- Architecture diagrams

**Complexity:** Medium
**Dependencies:** P1

---

#### P4: Migration Guide
**Scope:** Clear path from v0.2.0 edge-based to v0.3.0 signals.

**Deliverables:**
- Step-by-step migration guide
- `harnessToReactive()` adapter
- Before/after examples
- Common pitfalls
- FAQ

**Complexity:** Medium
**Dependencies:** P2

---

## Dependency Graph

```
F1 (Signal Primitives)
 │
 ├──▶ F2 (Basic Reactive Agent)
 │     │
 │     ├──▶ F3 (Signal Recording)
 │     │     │
 │     │     └──▶ E1 (Multi-Agent)
 │     │           │
 │     │           ├──▶ E2 (State as Signals)
 │     │           │     │
 │     │           │     └──▶ E3 (Parallel Execution)
 │     │           │           │
 │     │           │           └──▶ E4 (Reactive Graph API)
 │     │           │                 │
 │     │           │                 ├──▶ I1 (Reporters)
 │     │           │                 │     │
 │     │           │                 │     └──▶ I2 (Vitest)
 │     │           │                 │
 │     │           │                 └──▶ I3 (Providers)
 │     │           │
 │     │           └──▶ P1 (Trading Example)
 │     │                 │
 │     │                 ├──▶ P2 (External Docs)
 │     │                 │     │
 │     │                 │     └──▶ P4 (Migration)
 │     │                 │
 │     │                 └──▶ P3 (Internal Docs)
```

---

## Epic Summary Table

| ID | Epic | Milestone | Complexity | Status |
|----|------|-----------|------------|--------|
| F1 | Signal Primitives | Foundation | Medium | Planned |
| F2 | Basic Reactive Agent | Foundation | Medium | Planned |
| F3 | Signal Recording | Foundation | High | Planned |
| E1 | Multi-Agent Signals | Execution | Medium | Planned |
| E2 | State as Signals | Execution | High | Planned |
| E3 | Parallel Execution | Execution | High | Planned |
| E4 | Reactive Graph API | Execution | Medium | Planned |
| I1 | Signal-Based Reporters | Integration | Medium | Planned |
| I2 | Vitest Integration | Integration | Medium | Planned |
| I3 | Provider Signal Emission | Integration | Low | Planned |
| P1 | Trading Agent Example | Polish | High | Planned |
| P2 | External Documentation | Polish | Medium | Planned |
| P3 | Internal Documentation | Polish | Medium | Planned |
| P4 | Migration Guide | Polish | Medium | Planned |

---

## Estimated Timeline

**Note:** Rough estimates, will refine as we start.

| Milestone | Duration | Cumulative |
|-----------|----------|------------|
| Foundation | 2-3 weeks | 2-3 weeks |
| Execution | 3-4 weeks | 5-7 weeks |
| Integration | 2 weeks | 7-9 weeks |
| Polish | 2-3 weeks | 9-12 weeks |

**Total:** ~10-12 weeks for full v0.3.0

---

## Next Steps

1. [ ] Ship v0.2.0 (current work)
2. [ ] Review and finalize architecture decisions
3. [ ] Create GitHub milestones and epics
4. [ ] Begin F1 (Signal Primitives)
