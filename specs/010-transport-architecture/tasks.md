# Tasks: Transport Architecture

**Input**: Design documents from `/specs/010-transport-architecture/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Test tasks included (unit tests required per plan.md verification gates)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Context Manifest

### Default Context Rules

> Applies to ALL tasks unless overridden in a specific phase

**Read from** (implementing agent SHOULD access):
- `specs/010-transport-architecture/spec.md` - requirements and user stories
- `specs/010-transport-architecture/plan.md` - implementation plan and structure
- `specs/010-transport-architecture/data-model.md` - entity definitions
- `specs/010-transport-architecture/contracts/transport.ts` - API contracts
- `packages/sdk/src/` - existing source code patterns

**Do NOT read from** (prototype isolation):
- `examples/` - prototype code that may cause divergence
- `listr2/` - external library examples
- `specs/ready/` - superseded specs (interactive-sessions.md, unified-events.md)
- Other feature specs (stay focused on current feature)

### Phase-Specific Overrides

**Phase 2 (Foundational)**:
- Additional read: `packages/sdk/src/core/unified-event-bus.ts` - event bus integration point
- Additional read: `packages/sdk/src/harness/harness-instance.ts` - primary file to extend

**Phase 3 (User Story 1)**:
- Additional read: `packages/sdk/src/harness/define-renderer.ts` - existing renderer pattern

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Project**: `packages/sdk/` (SDK library)
- **Source**: `packages/sdk/src/`
- **Tests**: `packages/sdk/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [X] T001 Add Transport and Attachment types to packages/sdk/src/core/unified-events/types.ts
- [X] T002 [P] Add TransportStatus type to packages/sdk/src/core/unified-events/types.ts
- [X] T003 [P] Add UserResponse interface with Zod schema in packages/sdk/src/core/unified-events/types.ts
- [X] T004 [P] Add InjectedMessage interface in packages/sdk/src/core/unified-events/types.ts
- [X] T005 [P] Add session event types (SessionPromptEvent, SessionReplyEvent, SessionAbortEvent) in packages/sdk/src/harness/event-context.ts
- [X] T006 Re-export new types from packages/sdk/src/core/unified-events/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Create AsyncQueue<T> class in packages/sdk/src/harness/async-queue.ts
- [X] T008 Unit test for AsyncQueue in packages/sdk/tests/unit/async-queue.test.ts
- [X] T009 [P] Create SessionContext class in packages/sdk/src/harness/session-context.ts
- [X] T010 Unit test for SessionContext in packages/sdk/tests/unit/session-context.test.ts
- [X] T011 Extend HarnessInstance interface to implement Transport in packages/sdk/src/harness/harness-instance.ts
- [X] T011b Implement subscribe(filter?, listener) method on HarnessInstance in packages/sdk/src/harness/harness-instance.ts

**Checkpoint**: Foundation ready - Transport types defined, AsyncQueue and SessionContext implemented

---

## Phase 3: User Story 1 - Fire-and-Forget Execution with Attachments (Priority: P1) 🎯 MVP

**Goal**: Enable running harnesses with multiple attachments using fluent `.attach().run()` API

**Independent Test**: Attach a console renderer and metrics collector, run a simple workflow, verify all events captured and cleanup functions called

### Tests for User Story 1

- [X] T012 [P] [US1] Unit test for attach() chaining in packages/sdk/tests/unit/transport.test.ts
- [X] T013 [P] [US1] Unit test for cleanup function invocation in packages/sdk/tests/unit/transport.test.ts
- [X] T014 [P] [US1] Unit test for event order consistency in packages/sdk/tests/unit/transport.test.ts

### Implementation for User Story 1

- [X] T015 [US1] Implement attach(attachment) method returning `this` in packages/sdk/src/harness/harness-instance.ts
- [X] T016 [US1] Store attachments array in HarnessInstance with cleanup tracking in packages/sdk/src/harness/harness-instance.ts
- [X] T017 [US1] Call attachment(transport) on run() start, store returned cleanup in packages/sdk/src/harness/harness-instance.ts
- [X] T018 [US1] Call all cleanup functions (in reverse order) on run() completion in packages/sdk/src/harness/harness-instance.ts
- [X] T019 [US1] Throw error if attach() called after run() started in packages/sdk/src/harness/harness-instance.ts
- [X] T020 [US1] Implement status property state machine (idle → running → complete) in packages/sdk/src/harness/harness-instance.ts
- [X] T021 [US1] Update defineRenderer helper to return Attachment type in packages/sdk/src/harness/define-renderer.ts

**Checkpoint**: User Story 1 functional - harness.create(input).attach(renderer).run() works with cleanup

---

## Phase 4: User Story 2 - Interactive Session with User Prompts (Priority: P2)

**Goal**: Enable workflows that pause for user input with waitForUser() blocking until reply

**Independent Test**: Start session, trigger waitForUser(), send reply via transport.reply(), verify workflow resumes

### Tests for User Story 2

- [X] T022 [P] [US2] Unit test for startSession().complete() flow in packages/sdk/tests/unit/transport.test.ts
- [X] T023 [P] [US2] Unit test for waitForUser() blocking/unblocking in packages/sdk/tests/unit/session-context.test.ts
- [X] T024 [P] [US2] Unit test for commands ignored when session not active in packages/sdk/tests/unit/transport.test.ts
- [X] T025 [P] [US2] Replay test for interactive session round-trip in packages/sdk/tests/replay/interactive-session.test.ts

### Implementation for User Story 2

- [X] T026 [US2] Implement sessionActive property (default false) in packages/sdk/src/harness/harness-instance.ts
- [X] T027 [US2] Implement startSession() method to enable session mode in packages/sdk/src/harness/harness-instance.ts
- [X] T028 [US2] Implement complete() method for interactive session completion in packages/sdk/src/harness/harness-instance.ts
- [X] T029 [US2] Add promptResolvers Map for pending prompt responses in packages/sdk/src/harness/harness-instance.ts
- [X] T030 [US2] Implement reply(promptId, response) resolving pending promises in packages/sdk/src/harness/harness-instance.ts
- [X] T031 [US2] Connect SessionContext to HarnessInstance message/prompt infrastructure in packages/sdk/src/harness/session-context.ts
- [X] T032 [US2] Emit user:prompt event when waitForUser() called in packages/sdk/src/harness/session-context.ts
- [X] T033 [US2] Emit user:reply event when reply() resolves waitForUser() in packages/sdk/src/harness/harness-instance.ts
- [X] T034 [US2] Add session property to ExecuteContext when sessionActive in packages/sdk/src/factory/define-harness.ts

**Checkpoint**: User Story 2 functional - interactive prompts work with waitForUser()/reply() round-trip

---

## Phase 5: User Story 3 - WebSocket/SSE Bridge Attachment (Priority: P2)

**Goal**: Enable bidirectional bridge attachments that forward events and receive commands

**Independent Test**: Attach mock WebSocket, run workflow, verify events forwarded as JSON, simulate incoming commands

### Tests for User Story 3

- [X] T035 [P] [US3] Unit test for send(message) queuing in packages/sdk/tests/unit/transport.test.ts
- [X] T036 [P] [US3] Unit test for sendTo(agent, message) in packages/sdk/tests/unit/transport.test.ts
- [X] T037 [P] [US3] Unit test for async iterator over events in packages/sdk/tests/unit/transport.test.ts

### Implementation for User Story 3

- [X] T038 [US3] Implement send(message) queueing to messageQueue in packages/sdk/src/harness/harness-instance.ts
- [X] T039 [US3] Implement sendTo(agent, message) with agent targeting in packages/sdk/src/harness/harness-instance.ts
- [X] T040 [US3] Implement hasMessages() checking messageQueue in packages/sdk/src/harness/session-context.ts
- [X] T041 [US3] Implement readMessages() draining messageQueue in packages/sdk/src/harness/session-context.ts
- [X] T042 [US3] Implement [Symbol.asyncIterator]() for async event iteration in packages/sdk/src/harness/harness-instance.ts
- [X] T043 [US3] Guard send/sendTo/reply to no-op when sessionActive=false in packages/sdk/src/harness/harness-instance.ts

**Checkpoint**: User Story 3 functional - bidirectional message flow works for bridge patterns

---

## Phase 6: User Story 4 - Graceful Abort Handling (Priority: P3)

**Goal**: Enable timeout handling and user cancellation via transport.abort()

**Independent Test**: Attach timeout abort, run long workflow, verify abort after timeout, confirm cleanup called

### Tests for User Story 4

- [X] T044 [P] [US4] Unit test for abort(reason) setting status to aborted in packages/sdk/tests/unit/transport.test.ts
- [X] T045 [P] [US4] Unit test for isAborted() returning true after abort in packages/sdk/tests/unit/session-context.test.ts
- [X] T046 [P] [US4] Unit test for abort() idempotency (second call no-op) in packages/sdk/tests/unit/transport.test.ts
- [X] T047 [P] [US4] Unit test for cleanup functions called on abort in packages/sdk/tests/unit/transport.test.ts

### Implementation for User Story 4

- [X] T048 [US4] Add abortController to HarnessInstance in packages/sdk/src/harness/harness-instance.ts
- [X] T049 [US4] Implement abort(reason) calling abortController.abort() in packages/sdk/src/harness/harness-instance.ts
- [X] T050 [US4] Transition status to 'aborted' on abort() in packages/sdk/src/harness/harness-instance.ts
- [X] T051 [US4] Emit session:abort event when abort() called in packages/sdk/src/harness/harness-instance.ts
- [X] T052 [US4] Implement isAborted() in SessionContext checking abort signal in packages/sdk/src/harness/session-context.ts
- [X] T053 [US4] Ensure cleanup functions called on abort completion in packages/sdk/src/harness/harness-instance.ts
- [X] T054 [US4] Add 'aborted' status to HarnessCompleteEvent in packages/sdk/src/harness/event-context.ts

**Checkpoint**: User Story 4 functional - abort triggers graceful shutdown with cleanup

---

## Phase 7: User Story 5 - Conditional Attachment Based on Environment (Priority: P3)

**Goal**: Enable optional attachments with fluent conditional API

**Independent Test**: Create harness with/without env flags, verify only expected attachments active

### Tests for User Story 5

- [X] T055 [P] [US5] Unit test for harness running with no attachments in packages/sdk/tests/unit/transport.test.ts
- [X] T056 [P] [US5] Unit test for conditional attach() based on env in packages/sdk/tests/unit/transport.test.ts
- [X] T057 [P] [US5] Unit test for pre-registered attachments via options in packages/sdk/tests/unit/transport.test.ts

### Implementation for User Story 5

- [X] T058 [US5] Support attachments array in HarnessOptions in packages/sdk/src/factory/define-harness.ts
- [X] T059 [US5] Pre-register options.attachments in create() method in packages/sdk/src/factory/define-harness.ts
- [X] T060 [US5] Verify harness runs correctly with zero attachments in packages/sdk/src/harness/harness-instance.ts

**Checkpoint**: User Story 5 functional - conditional and pre-configured attachments work

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T061 Update sessionMode flag in HarnessStartEvent in packages/sdk/src/harness/event-context.ts
- [X] T062 [P] Add waitForUser timeout support in packages/sdk/src/harness/session-context.ts
- [X] T063 [P] Add first-reply-wins logic for multiple replies in packages/sdk/src/harness/harness-instance.ts
- [X] T064 Run quickstart.md validation scenarios manually
- [X] T065 Verify all existing tests pass (backward compatibility gate)
- [X] T066 Verify 80% line coverage for new code

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (P1): Core attachment/run flow - MVP baseline
  - US2 (P2): Interactive sessions - builds on US1
  - US3 (P2): Bridge patterns - can run in parallel with US2
  - US4 (P3): Abort handling - can run in parallel with US2/US3
  - US5 (P3): Conditional attachment - can run in parallel with others
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories - **MVP**
- **User Story 2 (P2)**: Can start after Foundational - Uses attach() from US1 but independently testable
- **User Story 3 (P2)**: Can start after Foundational - Uses send/subscribe but independently testable
- **User Story 4 (P3)**: Can start after Foundational - Uses attach/cleanup from US1 but independently testable
- **User Story 5 (P3)**: Can start after Foundational - Uses attach() from US1 but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Core method implementation before edge cases
- Unit tests before integration tests
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks T001-T006 can run in parallel (different type additions)
- Foundational: T007-T008 (AsyncQueue) in parallel with T009-T010 (SessionContext)
- All tests marked [P] within a story can run in parallel
- US2, US3, US4, US5 can be worked on in parallel after US1 establishes the base patterns

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for attach() chaining in packages/sdk/tests/unit/transport.test.ts"
Task: "Unit test for cleanup function invocation in packages/sdk/tests/unit/transport.test.ts"
Task: "Unit test for event order consistency in packages/sdk/tests/unit/transport.test.ts"
```

## Parallel Example: Foundational Infrastructure

```bash
# AsyncQueue and SessionContext can be built in parallel:
Task: "Create AsyncQueue<T> class in packages/sdk/src/harness/async-queue.ts"
Task: "Create SessionContext class in packages/sdk/src/harness/session-context.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (AsyncQueue, SessionContext base)
3. Complete Phase 3: User Story 1 (attach/run/cleanup)
4. **STOP and VALIDATE**: Test `.attach(renderer).run()` works with cleanup
5. Merge as initial increment

### Incremental Delivery

1. **Phase 1-2**: Setup + Foundational → Types and infrastructure ready
2. **Phase 3 (US1)**: Fire-and-forget → MVP deployable! `.attach().run()`
3. **Phase 4 (US2)**: Interactive → HITL workflows with `waitForUser()`
4. **Phase 5 (US3)**: Bridge → WebSocket/SSE integration
5. **Phase 6 (US4)**: Abort → Timeout/cancellation support
6. **Phase 7 (US5)**: Conditional → Environment-based attachment
7. **Phase 8**: Polish → Edge cases, docs, coverage

Each story adds capability without breaking previous functionality.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability (US1-US5)
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Performance targets**: 1000 events/sec, <100ms prompt round-trip (per plan.md)
- **Backward compatibility**: Existing tests must pass without modification
