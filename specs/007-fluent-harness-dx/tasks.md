# Tasks: Fluent Harness DX

**Input**: Design documents from `/specs/007-fluent-harness-dx/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are included as they are needed to verify the API works correctly and achieve the 90%+ coverage success criteria (SC-005).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Context Manifest

### Default Context Rules

> Applies to ALL tasks unless overridden in a specific phase

**Read from** (implementing agent SHOULD access):
- `specs/007-fluent-harness-dx/spec.md` - requirements and user stories
- `specs/007-fluent-harness-dx/plan.md` - implementation plan and structure
- `specs/007-fluent-harness-dx/data-model.md` - type definitions
- `specs/007-fluent-harness-dx/contracts/api.md` - API contracts
- `packages/sdk/src/` - existing source code patterns
- `packages/sdk/tests/` - existing test patterns

**Do NOT read from** (prototype isolation):
- `examples/` - prototype code that may cause divergence
- `specs/backlog/` - backlog documents with outdated implementation details
- `listr2/examples/` - external dependency examples
- `harnesses/coding/` - only read when migrating in Phase 8
- Other feature specs (stay focused on current feature)

### Phase-Specific Overrides

**Phase 2 (Foundational)**:
- Additional read: `packages/sdk/src/core/container.ts` - existing DI patterns
- Additional read: `packages/sdk/src/core/event-bus.ts` - existing event patterns

**Phase 8 (User Story 7 - Backward Compatibility)**:
- Additional read: `harnesses/coding/` - existing harness for migration proof

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [ ] T001 Create event types file with all harness event interfaces in packages/sdk/src/harness/event-types.ts
- [ ] T002 [P] Create stub for define-harness factory in packages/sdk/src/factory/define-harness.ts
- [ ] T003 [P] Create stub for wrap-agent factory in packages/sdk/src/factory/wrap-agent.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T004 Implement HarnessInstance class with on(), run(), and state in packages/sdk/src/harness/harness-instance.ts
- [ ] T005 Implement ExecuteContext class with agents, state, emit() in packages/sdk/src/harness/execute-context.ts
- [ ] T006 [P] Create control-flow helpers module (retry, parallel) in packages/sdk/src/harness/control-flow.ts
- [ ] T007 Export new types from packages/sdk/src/index.ts (HarnessEvent types, control flow types)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Zero DI Exposure (Priority: P1)

**Goal**: Workflow authors define harnesses without knowing about dependency injection

**Independent Test**: Write a harness using the new API. Verify compilation succeeds and runtime works without any imports from DI internals or use of `createContainer`.

### Implementation for User Story 1

- [ ] T008 [US1] Implement internal container creation in defineHarness() in packages/sdk/src/factory/define-harness.ts
- [ ] T009 [US1] Implement agent resolution from constructor config to instances in packages/sdk/src/factory/define-harness.ts
- [ ] T010 [US1] Connect agent resolution to HarnessInstance.run() in packages/sdk/src/harness/harness-instance.ts
- [ ] T011 [US1] Add unit test verifying no container imports needed in tests/unit/factory/define-harness.test.ts

**Checkpoint**: User Story 1 complete - harnesses work without DI knowledge

---

## Phase 4: User Story 2 - Typed Agent Access (Priority: P1)

**Goal**: Declare agents in configuration and access them with full type inference

**Independent Test**: Define a harness with named agents (e.g., planner, coder). In the execute function, verify that agent methods have correct return type inference and IDE autocomplete works.

### Implementation for User Story 2

- [ ] T012 [US2] Implement ResolvedAgents<T> type helper for constructor-to-instance mapping in packages/sdk/src/factory/define-harness.ts
- [ ] T013 [US2] Add generic type parameters TAgents to HarnessConfig in packages/sdk/src/factory/define-harness.ts
- [ ] T014 [US2] Wire typed agents to ExecuteContext in packages/sdk/src/harness/execute-context.ts
- [ ] T015 [US2] Add type inference test verifying autocomplete works in tests/unit/factory/define-harness.test.ts

**Checkpoint**: User Story 2 complete - full type inference for agents

---

## Phase 5: User Story 3 - Declarative Event Handling (Priority: P1)

**Goal**: Configure event handlers at harness creation with auto-cleanup

**Independent Test**: Create a harness with event handlers attached via fluent API. Run the harness and verify callbacks are invoked and auto-cleaned up.

### Implementation for User Story 3

- [ ] T016 [US3] Implement subscription tracking in HarnessInstance in packages/sdk/src/harness/harness-instance.ts
- [ ] T017 [US3] Connect internal EventBus to external .on() handlers with auto-cleanup when run() completes in packages/sdk/src/harness/harness-instance.ts
- [ ] T019 [US3] Add test verifying event handlers receive events and auto-cleanup in tests/unit/harness/harness-instance.test.ts

**Checkpoint**: User Story 3 complete - declarative events with auto-cleanup

---

## Phase 6: User Story 4 - Separation of Concerns (Priority: P1)

**Goal**: execute() contains only business logic, rendering handled externally

**Independent Test**: Write a harness execute() that uses only structured event emission. Register external handler that logs. Verify output matches.

### Implementation for User Story 4

- [ ] T020 [US4] Implement phase() helper with auto start/complete/failed events per Contextual Event Wrapper Pattern in packages/sdk/src/harness/execute-context.ts
- [ ] T021 [US4] Implement task() helper with auto start/complete/failed events per Contextual Event Wrapper Pattern in packages/sdk/src/harness/execute-context.ts
- [ ] T022 [US4] Implement retry() helper with retry:start/attempt/backoff/success/failure events per Contextual Event Wrapper Pattern in packages/sdk/src/harness/control-flow.ts
- [ ] T023 [US4] Implement parallel() helper with parallel:start/item:complete/complete events per Contextual Event Wrapper Pattern in packages/sdk/src/harness/control-flow.ts
- [ ] T024 [US4] Wire control flow helpers to ExecuteContext in packages/sdk/src/harness/execute-context.ts
- [ ] T025 [US4] Add tests for phase/task/retry/parallel helpers in tests/unit/harness/execute-context.test.ts
- [ ] T026 [P] [US4] Add control flow tests in tests/unit/harness/control-flow.test.ts

**Checkpoint**: User Story 4 complete - clean separation of business logic from rendering

---

## Phase 7: User Story 5 & 6 - State Factory and Mode Configuration (Priority: P2)

**Goal**: State factory pattern for parameterized harnesses + live/replay mode support

**Independent Test**: Define harness with state factory, create two instances with different inputs, verify isolated state. Define harness with replay mode, verify replay runners used.

### Implementation for User Story 5 & 6

- [ ] T027 [US5] Implement state factory execution in HarnessFactory.create() in packages/sdk/src/factory/define-harness.ts
- [ ] T028 [US5] Add TInput generic parameter for state factory input in packages/sdk/src/factory/define-harness.ts
- [ ] T029 [US6] Implement mode configuration (live/replay) in defineHarness in packages/sdk/src/factory/define-harness.ts
- [ ] T030 [US6] Pass mode to internal container creation in packages/sdk/src/factory/define-harness.ts
- [ ] T031 [US5] Add state factory isolation test in tests/unit/factory/define-harness.test.ts
- [ ] T032 [US6] Add mode configuration test in tests/unit/factory/define-harness.test.ts

**Checkpoint**: User Stories 5 & 6 complete - parameterized harnesses with mode support

---

## Phase 8: User Story 7 - Backward Compatibility (Priority: P2)

**Goal**: Existing harness classes remain available for gradual migration

**Independent Test**: Run existing harness classes unchanged. Verify they still work with createContainer() and container.get().

### Implementation for User Story 7

- [ ] T033 [US7] Verify existing exports still present in packages/sdk/src/index.ts (createContainer, BaseHarness, createTaskHarness)
- [ ] T034 [US7] Add backward compatibility test running legacy harness pattern in tests/integration/backward-compat.test.ts
- [ ] T035 [US7] Migrate coding harness to new API as proof-of-concept in harnesses/coding/ (demonstrates 50%+ code reduction)

**Checkpoint**: User Story 7 complete - backward compatibility verified

---

## Phase 9: Level 1 API - wrapAgent

**Goal**: Single agent one-liner API for simple use cases

### Implementation for wrapAgent

- [ ] T036 Implement wrapAgent() function in packages/sdk/src/factory/wrap-agent.ts
- [ ] T037 Implement WrappedAgent.on() for chainable event subscription in packages/sdk/src/factory/wrap-agent.ts
- [ ] T038 Implement WrappedAgent.run() connecting to agent execute method in packages/sdk/src/factory/wrap-agent.ts
- [ ] T039 Add wrapAgent tests in tests/unit/factory/wrap-agent.test.ts

**Checkpoint**: Level 1 API complete - single agent usage simplified

---

## Phase 10: Integration & Polish

**Purpose**: End-to-end verification and cross-cutting concerns

- [ ] T040 Create integration test with replay recordings in tests/integration/fluent-harness.test.ts (must include recursive agent call test per spec edge case)
- [ ] T041 Update package exports in packages/sdk/src/index.ts with all new APIs
- [ ] T042 Run quickstart.md examples as verification (SC-008 Ultimate Test)
- [ ] T043 Verify SC-001: coding harness has 50%+ code reduction
- [ ] T044 Verify SC-005: Unit test coverage >= 90% for new code

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1 (Phase 3) can start after Foundational
  - US2 (Phase 4) depends on US1 (needs agent resolution working)
  - US3 (Phase 5) can start after Foundational (parallel with US2)
  - US4 (Phase 6) depends on US3 (needs event system)
  - US5 & US6 (Phase 7) can start after US1
  - US7 (Phase 8) can start after Foundational
- **Level 1 API (Phase 9)**: Depends on US1 (agent resolution)
- **Polish (Phase 10)**: Depends on all prior phases

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (agent resolution infrastructure)
- **User Story 3 (P1)**: No dependencies on other stories (parallel with US2)
- **User Story 4 (P1)**: Depends on US3 (needs event subscription working)
- **User Story 5 (P2)**: Depends on US1 (needs factory pattern)
- **User Story 6 (P2)**: Depends on US1 (needs container creation)
- **User Story 7 (P2)**: No dependencies (backward compat is independent)

### Parallel Opportunities

- Setup: T002 and T003 can run in parallel
- Foundational: T006 can run in parallel with T004/T005
- US4: T026 can run in parallel with T025
- US5 & US6 (Phase 7) can run in parallel with US7 (Phase 8)
- Level 1 API (Phase 9) can run in parallel with US7 (Phase 8)

---

## Parallel Example: User Story 4

```bash
# Launch all tests for User Story 4 together:
Task: T025 "Add tests for phase/task/retry/parallel helpers"
Task: T026 "Add control flow tests"

# These can run after their implementations are complete
```

---

## Implementation Strategy

### MVP First (User Story 1-4 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Zero DI Exposure)
4. Complete Phase 4: User Story 2 (Typed Agent Access)
5. Complete Phase 5: User Story 3 (Declarative Events)
6. Complete Phase 6: User Story 4 (Separation of Concerns)
7. **STOP and VALIDATE**: All P1 stories complete, core API functional
8. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add US1-US4 (P1 stories) -> Core API functional (MVP!)
3. Add US5 & US6 (State factory + Mode) -> Full configuration
4. Add US7 (Backward compat) -> Migration path verified
5. Add wrapAgent (Level 1) -> Simple API complete
6. Polish -> Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Commit after each task or logical group
- Stop at any checkpoint to validate story
- Avoid: vague tasks, same file conflicts
- See "Dependencies & Execution Order" section for story prerequisites
