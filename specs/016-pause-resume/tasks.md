# Tasks: Flow Pause/Resume with Session Persistence

**Input**: Design documents from `/specs/016-pause-resume/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Per Constitution Principle III (Test-First Development), tests are included for all features. Unit tests for state machine logic, replay tests for pause/resume sequences.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. Note: US1-US3 are all P1 priority and form an atomic capability pair—they are ordered for implementation clarity (pause must work before resume can be tested).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Package location**: `packages/kernel/`
- **Source**: `packages/kernel/src/`
- **Tests**: `packages/kernel/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type foundation

- [ ] T001 Add "paused" to HubStatus union type in packages/kernel/src/protocol/hub.ts
- [ ] T002 [P] Create PauseOptions interface in packages/kernel/src/protocol/hub.ts
- [ ] T003 [P] Create SessionState interface in packages/kernel/src/protocol/flow-runtime.ts
- [ ] T004 [P] Create ResumeRequest interface (message required) in packages/kernel/src/protocol/flow-runtime.ts
- [ ] T005 [P] Add FlowPausedEvent type to packages/kernel/src/protocol/events.ts
- [ ] T006 [P] Add FlowResumedEvent type to packages/kernel/src/protocol/events.ts
- [ ] T007 [P] Create Zod schemas for SessionState, PauseOptions in packages/kernel/src/protocol/flow-runtime.ts
- [ ] T008 [P] Create SessionNotFoundError and SessionAlreadyRunningError classes in packages/kernel/src/protocol/errors.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Connect SessionContext to Hub: add _sessionContext private property to HubImpl in packages/kernel/src/engine/hub.ts
- [ ] T010 Add _pausedSessions Map<string, SessionState> to HubImpl in packages/kernel/src/engine/hub.ts
- [ ] T011 Implement getAbortSignal() method on HubImpl in packages/kernel/src/engine/hub.ts
- [ ] T012 Update Hub protocol interface to include new method signatures in packages/kernel/src/protocol/hub.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Pause Running Flow (Priority: P1) 🎯 MVP

**Goal**: Enable external systems to pause a running flow so they can inject additional context before the agent continues

**Independent Test**: Start a flow with a long-running agent node, call abort({resumable: true}), verify flow stops and emits flow:paused event with session context

### Tests for User Story 1 (Required per Constitution III) ✓

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [US1] Unit test: abort({resumable: true}) emits flow:paused in packages/kernel/tests/unit/pause-resume.test.ts
- [ ] T014 [P] [US1] Unit test: abort({resumable: true}) sets status to "paused" in packages/kernel/tests/unit/pause-resume.test.ts
- [ ] T015 [P] [US1] Unit test: abort({resumable: true}) triggers abortController.abort() in packages/kernel/tests/unit/pause-resume.test.ts
- [ ] T016 [P] [US1] Unit test: abort() without options emits session:abort (backward compat) in packages/kernel/tests/unit/pause-resume.test.ts

### Implementation for User Story 1

- [ ] T017 [US1] Extend abort() method signature to accept PauseOptions in packages/kernel/src/engine/hub.ts
- [ ] T018 [US1] Implement abort({resumable: true}) logic: set status to "paused", emit flow:paused in packages/kernel/src/engine/hub.ts
- [ ] T019 [US1] Call abortController.abort() in abort() method in packages/kernel/src/engine/hub.ts
- [ ] T020 [US1] Add abort signal check between nodes in executor loop in packages/kernel/src/flow/executor.ts
- [ ] T021 [US1] Add abort signal check during agent execution in for-await loop in packages/kernel/src/providers/claude.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - flows can be paused and emit flow:paused events

---

## Phase 4: User Story 2 - Resume Paused Flow (Priority: P1)

**Goal**: Enable external systems to resume a paused flow with the same session context so the agent can continue from where it left off

**Independent Test**: Pause a flow, then call resume(sessionId), verify flow continues from paused state and emits flow:resumed event

### Tests for User Story 2 (Required per Constitution III) ✓

- [ ] T022 [P] [US2] Unit test: resume() emits flow:resumed in packages/kernel/tests/unit/pause-resume.test.ts
- [ ] T023 [P] [US2] Unit test: resume() sets status to "running" in packages/kernel/tests/unit/pause-resume.test.ts
- [ ] T024 [P] [US2] Unit test: resume() with invalid sessionId throws SessionNotFoundError in packages/kernel/tests/unit/pause-resume.test.ts
- [ ] T025 [P] [US2] Unit test: resume() on already-running session throws SessionAlreadyRunningError in packages/kernel/tests/unit/pause-resume.test.ts

### Implementation for User Story 2

- [ ] T026 [US2] Capture SessionState on pause: store currentNodeId, currentNodeIndex, outputs in packages/kernel/src/engine/hub.ts
- [ ] T027 [US2] Implement resume(sessionId, message) method: validate sessionId, retrieve state in packages/kernel/src/engine/hub.ts
- [ ] T028 [US2] Create new SessionContext for resumed execution in packages/kernel/src/engine/hub.ts
- [ ] T029 [US2] Set status to "running" and emit flow:resumed event in packages/kernel/src/engine/hub.ts
- [ ] T030 [US2] Modify executor to accept resumption state and continue from currentNodeIndex in packages/kernel/src/flow/executor.ts
- [ ] T031 [US2] Remove SessionState from _pausedSessions on successful completion in packages/kernel/src/engine/hub.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should work - flows can be paused and resumed

---

## Phase 5: User Story 3 - Inject Context on Resume (Priority: P1)

**Goal**: Enable external systems to inject additional context when resuming a paused flow so the agent receives new input

**Independent Test**: Pause flow, inject a message via resume(sessionId, message), verify agent receives the injected message in its context

### Tests for User Story 3 (Required per Constitution III) ✓

- [ ] T032 [P] [US3] Unit test: resume(sessionId, message) requires non-empty message in packages/kernel/tests/unit/pause-resume.test.ts
- [ ] T033 [P] [US3] Unit test: message delivered via session:message on resume in packages/kernel/tests/unit/pause-resume.test.ts
- [ ] T034 [P] [US3] Unit test: agent receives injected message in its context after resume in packages/kernel/tests/unit/pause-resume.test.ts

### Implementation for User Story 3

- [ ] T035 [US3] Validate message is non-empty in resume() and queue into SessionState.pendingMessages in packages/kernel/src/engine/hub.ts
- [ ] T036 [US3] Deliver message via session:message pattern before resuming execution in packages/kernel/src/engine/hub.ts
- [ ] T037 [US3] Ensure agent nodes receive injected messages in their message history in packages/kernel/src/providers/claude.ts

**Checkpoint**: All P1 stories complete - core pause/resume with message injection works

---

## Phase 6: User Story 4 - Session State Persistence (Priority: P2)

**Goal**: Enable developers to inspect paused session state for debugging purposes

**Independent Test**: Pause flow, call getPausedSession(sessionId), verify response includes currentNodeId, phase, and accumulated context

### Tests for User Story 4 (Required per Constitution III) ✓

- [ ] T038 [P] [US4] Unit test: getPausedSession() returns SessionState in packages/kernel/tests/unit/pause-resume.test.ts
- [ ] T039 [P] [US4] Unit test: getPausedSession() returns undefined for invalid sessionId in packages/kernel/tests/unit/pause-resume.test.ts
- [ ] T040 [P] [US4] Unit test: SessionState includes outputs from completed nodes in packages/kernel/tests/unit/pause-resume.test.ts

### Implementation for User Story 4

- [ ] T041 [US4] Implement getPausedSession(sessionId) method in packages/kernel/src/engine/hub.ts
- [ ] T042 [US4] Ensure SessionState captures outputs from all completed nodes in packages/kernel/src/engine/hub.ts
- [ ] T043 [US4] Export SessionState type from package index for external inspection in packages/kernel/src/index.ts

**Checkpoint**: All user stories complete - full pause/resume feature with inspection capability

---

## Phase 7: Integration & Edge Cases

**Purpose**: Replay tests, edge case handling, integration validation

### Replay Tests

- [ ] T044 [P] Replay test: pause/resume sequence determinism in packages/kernel/tests/replay/pause-resume.test.ts
- [ ] T045 [P] Replay test: event ordering (flow:paused before status change) in packages/kernel/tests/replay/pause-resume.test.ts
- [ ] T046 [P] Replay test: context accumulation across pause boundary in packages/kernel/tests/replay/pause-resume.test.ts

### Edge Cases

- [ ] T047 [P] Handle abort() on already-paused flow → transitions to "aborted" in packages/kernel/src/engine/hub.ts
- [ ] T048 [P] Handle resume() called twice → second call is no-op if running in packages/kernel/src/engine/hub.ts
- [ ] T049 [P] Handle flow completes before abort processed → abort is no-op in packages/kernel/src/engine/hub.ts
- [ ] T050 Discard pending messages on terminal abort (not paused) in packages/kernel/src/engine/hub.ts

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and validation

- [ ] T051 [P] Update hub.mdx with abort({resumable}), resume(), getAbortSignal() docs in apps/docs/content/docs/reference/kernel-spec/spec/hub.mdx
- [ ] T052 [P] Update flow-runtime.mdx with pause/resume lifecycle docs in apps/docs/content/docs/reference/kernel-spec/spec/flow-runtime.mdx
- [ ] T053 [P] Update protocol-types.mdx with SessionState, PauseOptions, events in apps/docs/content/docs/reference/kernel-spec/reference/protocol-types.mdx
- [ ] T054 [P] Add note about cooperative pause via AbortSignal in node-catalog.mdx in apps/docs/content/docs/reference/kernel-spec/flow/node-catalog.mdx
- [ ] T055 Export new types from packages/kernel/src/index.ts (PauseOptions, SessionState, errors)
- [ ] T056 Run typecheck: `cd packages/kernel && bun run typecheck`
- [ ] T057 Run unit tests: `bun test tests/unit/pause-resume.test.ts`
- [ ] T058 Run replay tests: `bun test tests/replay/pause-resume.test.ts`
- [ ] T059 Run quickstart.md validation scenarios manually

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (Pause) must complete before US2 (Resume) can be tested
  - US2 (Resume) must complete before US3 (Inject) can be tested
  - US4 (Inspection) can proceed in parallel with US2/US3 after US1
- **Integration (Phase 7)**: Depends on US1-US4 completion
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Requires US1 completion (can't resume without pause working)
- **User Story 3 (P1)**: Requires US2 completion (can't inject without resume working)
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Independent of US2/US3

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Protocol types before implementation
- Core implementation before edge cases
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks T002-T008 can run in parallel
- All tests within a story marked [P] can run in parallel
- Edge case tasks T047-T050 can run in parallel
- Documentation tasks T051-T054 can run in parallel

---

## Parallel Example: Setup Phase

```bash
# Launch all type definitions together:
Task: T002 "Create PauseOptions interface"
Task: T003 "Create SessionState interface"
Task: T004 "Create ResumeRequest interface"
Task: T005 "Add FlowPausedEvent type"
Task: T006 "Add FlowResumedEvent type"
Task: T007 "Create Zod schemas"
Task: T008 "Create error classes"
```

## Parallel Example: User Story 1 Tests

```bash
# Launch all US1 tests together:
Task: T013 "Unit test: abort({resumable: true}) emits flow:paused"
Task: T014 "Unit test: abort({resumable: true}) sets status to paused"
Task: T015 "Unit test: abort({resumable: true}) triggers abortController.abort()"
Task: T016 "Unit test: abort() without options emits session:abort"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T008)
2. Complete Phase 2: Foundational (T009-T012)
3. Complete Phase 3: User Story 1 - Pause (T013-T021)
4. **STOP and VALIDATE**: Test pause functionality independently
5. External systems can now pause running flows

### Core Capability (US1 + US2 + US3)

1. Setup + Foundational → Foundation ready
2. US1 (Pause) → Test: flows can be paused
3. US2 (Resume) → Test: paused flows can resume
4. US3 (Inject) → Test: messages can be injected on resume
5. **Full pause/resume/inject capability working**

### Full Feature

1. Core Capability complete
2. US4 (Inspection) → Test: session state queryable
3. Integration tests → Test: determinism, edge cases
4. Polish → Docs, exports, validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1-US3 are P1 but have implementation order dependency (pause → resume → inject)
- US4 (P2) can proceed in parallel once US1 foundation exists
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
