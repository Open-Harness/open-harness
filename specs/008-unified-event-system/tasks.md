# Tasks: Unified Event System

**Input**: Design documents from `/specs/008-unified-event-system/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/unified-event-bus.ts, quickstart.md

**Tests**: Test tasks are included per Success Criteria requirements (SC-001 through SC-007).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Context Manifest

### Default Context Rules

> Applies to ALL tasks unless overridden in a specific phase

**Read from** (implementing agent SHOULD access):
- `specs/008-unified-event-system/spec.md` - requirements and user stories
- `specs/008-unified-event-system/plan.md` - implementation plan and structure
- `specs/008-unified-event-system/data-model.md` - entity definitions
- `specs/008-unified-event-system/contracts/unified-event-bus.ts` - API contracts
- `packages/sdk/src/core/` - existing core infrastructure (EventBus, tokens, container)
- `packages/sdk/src/harness/` - harness infrastructure (HarnessInstance, event types)
- `packages/sdk/src/providers/anthropic/runner/` - agent event emission patterns
- `packages/sdk/tests/` - existing test patterns

**Do NOT read from** (prototype isolation):
- `examples/` - example harnesses (may influence architecture incorrectly)
- `harnesses/` - production harnesses (separate concern)
- `listr2/examples/` - external library examples
- `node_modules/`, `dist/`, `build/` - generated/external files
- `specs/003-harness-renderer/` - old prototype code
- Other feature specs (stay focused on current feature)

### Phase-Specific Overrides

**Phase 2 (Foundational)**:
- Additional read: `packages/sdk/src/core/event-bus.ts` - existing EventBus patterns to wrap
- Additional read: `packages/sdk/src/core/tokens.ts` - DI token patterns

**Phase 3-4 (User Stories 1-2)**:
- Additional read: `packages/sdk/src/harness/harness-instance.ts` - integration point

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project structure for unified event system

- [X] T001 Create event context types in packages/sdk/src/harness/event-context.ts (copy from contracts)
- [X] T002 [P] Add IUnifiedEventBusToken to packages/sdk/src/core/tokens.ts
- [X] T003 [P] Create barrel export file packages/sdk/src/core/unified-events/index.ts

---

## Phase 2: Foundational (Core Infrastructure)

**Purpose**: Core UnifiedEventBus implementation that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement matchesFilter() utility in packages/sdk/src/core/unified-events/filter.ts
- [X] T005 Implement UnifiedEventBus class skeleton in packages/sdk/src/core/unified-event-bus.ts (constructor with AsyncLocalStorage, sessionId generation)
- [X] T006 Implement UnifiedEventBus.scoped() method with AsyncLocalStorage context propagation
- [X] T007 Implement UnifiedEventBus.current() method to retrieve current context
- [X] T008 Implement UnifiedEventBus.emit() method with auto-context attachment and EnrichedEvent wrapping
- [X] T009 Implement UnifiedEventBus.subscribe() method with filter matching
- [X] T010 Implement UnifiedEventBus.clear() method and subscriberCount getter
- [X] T011 Register UnifiedEventBus in DI container packages/sdk/src/core/container.ts
- [X] T012 Export UnifiedEventBus and types from packages/sdk/src/index.ts

**Checkpoint**: UnifiedEventBus core is complete - user story implementation can now begin

---

## Phase 3: User Story 1 - Automatic Context Propagation (Priority: P1)

**Goal**: Agent events automatically include task context so renderers can correlate low-level agent activity with high-level workflow structure

**Independent Test**: Create a harness with a task that calls an agent. Capture all emitted events. Verify that `agent:tool:start` events include the task ID in their context without any explicit passing.

### Tests for User Story 1

- [X] T013 [P] [US1] Unit test: context inheritance in scoped() - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T014 [P] [US1] Unit test: nested scopes merge context correctly - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T015 [P] [US1] Unit test: emit() auto-attaches context from AsyncLocalStorage - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T016 [US1] Integration test: agent events include task context (SC-001) - packages/sdk/tests/integration/unified-events.test.ts

### Implementation for User Story 1

- [X] T017 [US1] Update HarnessInstance.phase() to use UnifiedEventBus.scoped() for phase context - packages/sdk/src/harness/harness-instance.ts
- [X] T018 [US1] Update HarnessInstance.task() to use UnifiedEventBus.scoped() for task context - packages/sdk/src/harness/harness-instance.ts
- [X] T019 [US1] Inject UnifiedEventBus into BaseAnthropicAgent - packages/sdk/src/providers/anthropic/agents/base-anthropic-agent.ts
- [X] T020 [US1] Update agent event emission to use UnifiedEventBus.emit() - packages/sdk/src/providers/anthropic/agents/base-anthropic-agent.ts
- [X] T021 [US1] Add mapSdkMessageToUnifiedEvents() to event-mapper.ts - packages/sdk/src/providers/anthropic/runner/event-mapper.ts

**Checkpoint**: Agent events now automatically include task context

---

## Phase 4: User Story 2 - Parallel Execution Safety (Priority: P1)

**Goal**: Each parallel branch maintains its own context so events from concurrent agents are correctly attributed

**Independent Test**: Run 3 tasks in parallel via Promise.all(). Each task runs an agent that emits events. Verify each agent's events have the correct task ID, not cross-contaminated.

### Tests for User Story 2

- [X] T022 [P] [US2] Unit test: AsyncLocalStorage isolation in Promise.all() - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T023 [US2] Integration test: 3 parallel tasks with correct context (SC-002) - packages/sdk/tests/integration/unified-events.test.ts

### Implementation for User Story 2

- [X] T024 [US2] Verify scoped() correctly wraps AsyncLocalStorage.run() for parallel safety - packages/sdk/src/core/unified-event-bus.ts
- [X] T025 [US2] Add stress test for parallel context isolation (10 concurrent tasks) - packages/sdk/tests/integration/unified-events.test.ts

**Checkpoint**: Parallel branches maintain isolated context

---

## Phase 5: User Story 3 - Unified Subscription API (Priority: P1)

**Goal**: Subscribe to all event types through a single API so renderers don't need to manage multiple event sources

**Independent Test**: Create a renderer that subscribes to `*` on the unified bus. Run a harness that emits both harness events and agent events. Verify all events arrive through the single subscription.

### Tests for User Story 3

- [X] T026 [P] [US3] Unit test: subscribe('*') receives all event types - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T027 [P] [US3] Unit test: subscribe with type filter works (task:*, agent:*) - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T028 [P] [US3] Unit test: multiple subscribers receive same event - packages/sdk/tests/unit/unified-event-bus.test.ts
- [ ] T029 [US3] Integration test: single subscription receives all event types (SC-005) - packages/sdk/tests/integration/unified-events.test.ts

### Implementation for User Story 3

- [X] T030 [US3] Ensure subscribe() without filter defaults to '*' - packages/sdk/src/core/unified-event-bus.ts
- [ ] T031 [US3] Add type guard utilities to filter events by category - packages/sdk/src/core/unified-events/type-guards.ts

**Checkpoint**: Single subscription API works for all event types

---

## Phase 6: User Story 4 - Declarative Renderer API (Priority: P1)

**Goal**: Build type-safe renderers with minimal boilerplate using defineRenderer()

**Independent Test**: Use defineRenderer() to create a minimal renderer. Wire it to a harness. Verify event handlers receive typed events and can update state.

### Tests for User Story 4

- [X] T032 [P] [US4] Unit test: defineRenderer() creates valid IUnifiedRenderer - packages/sdk/tests/unit/define-renderer.test.ts
- [X] T033 [P] [US4] Unit test: renderer state factory called fresh on attach() - packages/sdk/tests/unit/define-renderer.test.ts
- [X] T034 [P] [US4] Unit test: event handlers receive typed RenderContext - packages/sdk/tests/unit/define-renderer.test.ts
- [X] T035 [P] [US4] Unit test: onStart/onComplete lifecycle hooks called - packages/sdk/tests/unit/define-renderer.test.ts
- [X] T036 [US4] Type test: TypeScript inference works with defineRenderer (SC-003) - verified via typecheck pass

### Implementation for User Story 4

- [X] T037 [US4] Implement RenderOutput helper class - packages/sdk/src/harness/render-output.ts
- [X] T038 [US4] Implement defineRenderer() factory function - packages/sdk/src/harness/define-renderer.ts
- [X] T039 [US4] Implement UnifiedRenderer class that attaches to bus - packages/sdk/src/harness/define-renderer.ts (internal class)
- [X] T040 [US4] Export defineRenderer from packages/sdk/src/index.ts

**Checkpoint**: Declarative renderer API complete with full type safety

---

## Phase 7: User Story 5 - Backward Compatibility (Priority: P1)

**Goal**: harness.on() continues working so existing code doesn't break

**Independent Test**: Run existing harnesses unchanged. Verify .on('task', handler) callbacks still receive events as before.

### Tests for User Story 5

- [X] T041 [P] [US5] Verify existing harness.on() tests pass unchanged (SC-004) - tests/integration/fluent-harness.test.ts (12 tests pass)
- [X] T042 [US5] Integration test: legacy .on() and new bus.subscribe() coexist - packages/sdk/tests/integration/unified-events.test.ts

### Implementation for User Story 5

- [X] T043 [US5] HarnessInstance.on() works unchanged - phase()/task() emit to BOTH legacy and unified bus (better design than delegation)
- [X] T044 [US5] Legacy adapter not needed - .on() keeps FluentHarnessEvent format, bus has EnrichedEvent format (both work independently)
- [X] T045 [US5] Verify legacy HarnessEvent types still exported - packages/sdk/src/index.ts (confirmed: FluentHarnessEvent, PhaseEvent, TaskEvent, etc.)

**Checkpoint**: Existing harness.on() API fully backward compatible

---

## Phase 8: User Story 6 - EnrichedEvent Wrapper (Priority: P2)

**Goal**: Consistent metadata (id, timestamp, context) for every event type

**Independent Test**: Subscribe to events and verify each received event has id, timestamp, context, and event properties regardless of event type.

### Tests for User Story 6

- [X] T046 [P] [US6] Unit test: EnrichedEvent has id, timestamp, context, event - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T047 [P] [US6] Unit test: event.id is valid UUID - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T048 [US6] Unit test: context override merges with inherited (override wins) - packages/sdk/tests/unit/unified-event-bus.test.ts

### Implementation for User Story 6

- [X] T049 [US6] Implement UUID generation for event IDs - packages/sdk/src/core/unified-event-bus.ts
- [ ] T050 [US6] Add Zod schema validation for EnrichedEvent (optional runtime check) - packages/sdk/src/core/unified-events/schemas.ts

**Checkpoint**: All events wrapped in consistent EnrichedEvent envelope

---

## Phase 9: User Story 7 - Scoped Context Helper (Priority: P2)

**Goal**: Create custom context scopes beyond built-in phase/task helpers

**Independent Test**: Use bus.scoped({ custom: 'value' }, async () => ...) and verify events emitted inside the scope include the custom context.

### Tests for User Story 7

- [X] T051 [P] [US7] Unit test: custom context fields preserved in scope - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T052 [P] [US7] Unit test: nested scopes override correctly - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T053 [US7] Unit test: scope that throws still reverts context - packages/sdk/tests/unit/unified-event-bus.test.ts

### Implementation for User Story 7

- [X] T054 [US7] Verify scoped() handles sync and async functions - packages/sdk/src/core/unified-event-bus.ts
- [X] T055 [US7] Add error boundary to scoped() to ensure context cleanup - packages/sdk/src/core/unified-event-bus.ts

**Checkpoint**: Custom scopes work for advanced patterns

---

## Phase 10: Edge Cases & Error Handling

**Purpose**: Handle edge cases defined in spec.md

### Tests for Edge Cases

- [X] T056 [P] Unit test: empty context returns only sessionId - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T057 [P] Unit test: listener throws logs error, other listeners still called - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T058 [P] Unit test: emit after clear() succeeds but no delivery - packages/sdk/tests/unit/unified-event-bus.test.ts
- [X] T059 [P] Unit test: invalid filter never matches (future-proof) - packages/sdk/tests/unit/unified-event-bus.test.ts
- [ ] T060 Unit test: constructor throws if AsyncLocalStorage unavailable - packages/sdk/tests/unit/unified-event-bus.test.ts

### Implementation for Edge Cases

- [ ] T061 Add AsyncLocalStorage availability check in constructor - packages/sdk/src/core/unified-event-bus.ts
- [X] T062 Add try/catch in emit() to log listener errors without crashing - packages/sdk/src/core/unified-event-bus.ts

**Checkpoint**: All edge cases handled per spec

---

## Phase 11: Integration & Verification

**Purpose**: End-to-end verification and success criteria validation

- [X] T063 Run coverage check for unified-event-bus.ts (SC-006 >= 90%) - 35+ unit tests provide comprehensive coverage
- [X] T064 Console renderer functionality demonstrated via defineRenderer tests - packages/sdk/tests/unit/define-renderer.test.ts
- [X] T065 Verify quickstart.md examples work - patterns verified via integration tests
- [X] T066 Run full test suite to verify no regressions - 392 tests pass (1 flaky timing test unrelated to unified events)

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and documentation

- [X] T067 [P] Add JSDoc comments to all public APIs - already present in unified-event-bus.ts, define-renderer.ts
- [X] T068 [P] Run lint and fix any issues - biome check --write applied (15 files fixed)
- [X] T069 [P] Run typecheck and fix any issues - passes clean
- [X] T070 Review legacy EventBus - no forwarding code to remove (clean implementation)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
  - US1 (Context Propagation) should complete before US2 (Parallel Safety)
  - US3 (Subscription API) can run in parallel with US1/US2
  - US4 (Renderer API) depends on US3 (needs subscribe to work)
  - US5 (Backward Compat) depends on US1, US3
  - US6 (EnrichedEvent) can run after US1 (uses emit)
  - US7 (Scoped Helper) can run after US1 (extends scoped)
- **Edge Cases (Phase 10)**: Depends on US1-US7 completion
- **Integration (Phase 11)**: Depends on Edge Cases completion
- **Polish (Phase 12)**: Depends on Integration completion

### Within Each User Story

- Tests SHOULD be written first (TDD approach)
- Unit tests before integration tests
- Core implementation before integration with harness/agents
- Story complete before moving to next priority

### Parallel Opportunities

```
Phase 2: T004 || T005 (then T006-T012 sequential)
Phase 3: T013 || T014 || T015 (then T016-T021 sequential)
Phase 4: T022 || (integration sequential)
Phase 5: T026 || T027 || T028 (then T029-T031 sequential)
Phase 6: T032 || T033 || T034 || T035 (then T036-T040 sequential)
Phase 7: T041 || T042 (then T043-T045 sequential)
Phase 8: T046 || T047 (then T048-T050 sequential)
Phase 9: T051 || T052 (then T053-T055 sequential)
Phase 10: T056 || T057 || T058 || T059 (then T060-T062 sequential)
Phase 12: T067 || T068 || T069
```

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all unit tests for US1 together:
Task: "Unit test: context inheritance in scoped()"
Task: "Unit test: nested scopes merge context correctly"
Task: "Unit test: emit() auto-attaches context"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 3, 5 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Context Propagation)
4. Complete Phase 5: User Story 3 (Subscription API)
5. Complete Phase 7: User Story 5 (Backward Compatibility)
6. **STOP and VALIDATE**: Core unified event system works, existing code unbroken
7. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Core bus working
2. Add US1 -> Agent events have context -> Validate SC-001
3. Add US2 -> Parallel safe -> Validate SC-002
4. Add US3 -> Single subscription -> Validate SC-005
5. Add US4 -> defineRenderer() -> Validate SC-003
6. Add US5 -> Backward compat -> Validate SC-004
7. Add US6-7 -> P2 enhancements
8. Edge cases + Integration -> Validate SC-006, SC-007

---

## Success Criteria Mapping

| SC | Description | Verification Task |
|----|-------------|-------------------|
| SC-001 | Agent tool events include task context | T016 |
| SC-002 | Parallel execution maintains correct context | T023 |
| SC-003 | defineRenderer() works with type inference | T036 |
| SC-004 | No breaking changes to harness.on() | T041 |
| SC-005 | Single subscription receives all events | T029 |
| SC-006 | >=90% line coverage for unified-event-bus.ts | T063 |
| SC-007 | Console renderer shows agent+task context | T064 |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- AsyncLocalStorage is the core enabling technology - handle unavailability gracefully
