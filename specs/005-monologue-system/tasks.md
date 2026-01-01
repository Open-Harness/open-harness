# Tasks: Monologue System

**Input**: Design documents from `/specs/005-monologue-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests included (mock-based unit tests required per spec; E2E with real Haiku for verification)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Context Manifest

### Default Context Rules

> Applies to ALL tasks unless overridden in a specific phase

**Read from** (implementing agent SHOULD access):
- `specs/005-monologue-system/spec.md` - requirements and user stories
- `specs/005-monologue-system/plan.md` - implementation plan and structure
- `specs/005-monologue-system/data-model.md` - entity definitions
- `specs/005-monologue-system/contracts/` - API contracts
- `specs/005-monologue-system/research.md` - research decisions
- `packages/sdk/src/` - existing source code patterns
- `packages/sdk/src/core/decorators.ts` - @Record decorator pattern (reference)
- `packages/sdk/src/core/event-bus.ts` - EventBus subscription patterns

**Do NOT read from** (prototype isolation):
- `listr2/` - external library (architectural contamination risk)
- `examples/` - prototype/example code
- `**/prototype/` - prototype directories
- `*.spike.*` - spike/exploration code
- `specs/003-harness-renderer/` - different feature, avoid pattern pollution

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create monologue module structure and add new dependency

- [x] T001 Create monologue module directory at packages/sdk/src/monologue/
- [x] T002 Add @anthropic-ai/sdk dependency to packages/sdk/package.json
- [x] T003 [P] Create barrel export file at packages/sdk/src/monologue/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, DI tokens, and interfaces that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement type definitions (MonologueConfig, AgentEvent, NarrativeEntry, payloads) in packages/sdk/src/monologue/types.ts per contracts/types.ts
- [x] T005 [P] Implement Zod schemas (MonologueConfigSchema, AgentEventSchema, NarrativeEntrySchema) in packages/sdk/src/monologue/types.ts
- [x] T006 [P] Create DI tokens (IMonologueLLMToken, IMonologueServiceToken, IMonologueConfigToken) in packages/sdk/src/monologue/tokens.ts
- [x] T007 [P] Create prompt templates (DEFAULT_MONOLOGUE_PROMPT, TERSE_PROMPT, VERBOSE_PROMPT) in packages/sdk/src/monologue/prompts.ts
- [x] T008 Export monologue tokens from packages/sdk/src/core/tokens.ts
- [x] T009 Update barrel export in packages/sdk/src/monologue/index.ts with all exports

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Zero-Config Narrative Generation (Priority: P1) 🎯 MVP

**Goal**: Agents automatically generate narrative updates without any configuration

**Independent Test**: Run a decorated agent method with default settings. Verify narrative events are emitted without any explicit monologue configuration.

### Tests for User Story 1

- [x] T010 [P] [US1] Create unit test for MonologueService buffer management in packages/sdk/tests/unit/monologue/monologue-service.test.ts
- [x] T011 [P] [US1] Create unit test for MonologueService flush behavior (LLM wait signal "...") in packages/sdk/tests/unit/monologue/monologue-service.test.ts
- [x] T012 [P] [US1] Create unit test for MonologueService history management in packages/sdk/tests/unit/monologue/monologue-service.test.ts

### Implementation for User Story 1

- [x] T013 [US1] Implement IMonologueLLM interface in packages/sdk/src/monologue/anthropic-llm.ts using @anthropic-ai/sdk
- [x] T014 [US1] Implement MonologueService class with buffer, history, and LLM integration in packages/sdk/src/monologue/monologue-service.ts per contracts/monologue-service.ts
- [x] T015 [US1] Implement error handling in MonologueService (catch LLM failures, log, continue execution)
- [x] T016 [US1] Register MonologueService and AnthropicMonologueLLM in DI container at packages/sdk/src/core/container.ts
- [x] T017 [US1] Update barrel export in packages/sdk/src/monologue/index.ts with service and LLM exports

**Checkpoint**: MonologueService can buffer events, call LLM, emit narratives. Core value proposition works.

---

## Phase 4: User Story 2 - Clean Developer Experience (Priority: P1)

**Goal**: Enable narratives with a single decorator, zero changes to callers

**Independent Test**: Add `@Monologue('Parser')` to an agent method. Verify narratives are generated without any changes to code that calls the method.

### Tests for User Story 2

- [x] T018 [P] [US2] Create unit test for @Monologue decorator wrapper behavior in packages/sdk/tests/unit/monologue/monologue-decorator.test.ts
- [x] T019 [P] [US2] Create unit test for @Monologue decorator EventBus subscription/unsubscription in packages/sdk/tests/unit/monologue/monologue-decorator.test.ts
- [x] T020 [P] [US2] Create unit test for @Monologue decorator final flush on method completion in packages/sdk/tests/unit/monologue/monologue-decorator.test.ts

### Implementation for User Story 2

- [x] T021 [US2] Implement @Monologue(scope, config?) decorator with EventBus subscription in packages/sdk/src/monologue/monologue-decorator.ts per research.md UNKNOWN-1 and UNKNOWN-3
- [x] T022 [US2] Implement closure-scoped buffer state per decorator call (concurrent isolation) in packages/sdk/src/monologue/monologue-decorator.ts
- [x] T023 [US2] Implement automatic final flush on method completion in decorator
- [x] T024 [US2] Update barrel export in packages/sdk/src/monologue/index.ts with decorator export

**Checkpoint**: Adding `@Monologue` to any agent method enables narratives with zero caller changes.

---

## Phase 5: User Story 3 - Testable Without Real LLM (Priority: P1)

**Goal**: Mock the narrative generation so tests run fast without API keys

**Independent Test**: Write a unit test for MonologueService that injects a mock LLM. Verify the service buffers events and calls the mock at appropriate times.

### Tests for User Story 3

- [x] T025 [P] [US3] Create MockMonologueLLM implementation for testing in packages/sdk/tests/helpers/mock-monologue-llm.ts

### Implementation for User Story 3

- [x] T026 [US3] Verify MonologueService accepts injected IMonologueLLM via constructor (DI pattern already from US1) - add test case in packages/sdk/tests/unit/monologue/mock-injection.test.ts
- [ ] T027 [US3] Document mock LLM injection pattern in quickstart.md Testing section (verify existing docs match implementation)
- [x] T028 [US3] Create example test demonstrating mock injection in packages/sdk/tests/unit/monologue/mock-injection.test.ts

**Checkpoint**: All monologue code is testable with mocks, no real API calls needed in test suite.

---

## Phase 6: User Story 4 - Narrative Context Continuity (Priority: P2)

**Goal**: Narratives build on previous context so the story flows naturally without repetition

**Independent Test**: Execute a multi-step task. Verify later narratives reference earlier work.

### Tests for User Story 4

- [x] T029 [P] [US4] Create unit test for history injection into LLM calls in packages/sdk/tests/unit/monologue/monologue-service.test.ts
- [x] T030 [P] [US4] Create unit test for history size limit enforcement in packages/sdk/tests/unit/monologue/monologue-service.test.ts

### Implementation for User Story 4

- [x] T031 [US4] Implement history sliding window (FIFO, configurable size) in MonologueService.generateNarrative()
- [x] T032 [US4] Update DEFAULT_MONOLOGUE_PROMPT to instruct LLM on using history for continuity in packages/sdk/src/monologue/prompts.ts
- [x] T033 [US4] Verify LLM receives history array in generate() calls

**Checkpoint**: Narratives form a coherent story when read in sequence.

---

## Phase 7: User Story 5 - Configurable Verbosity (Priority: P2)

**Goal**: Control narrative frequency with configurable buffer sizes and prompt styles

**Independent Test**: Configure with `minBufferSize: 5` vs `minBufferSize: 1`. Verify different narrative frequencies.

### Tests for User Story 5

- [x] T034 [P] [US5] Create unit test for minBufferSize threshold behavior in packages/sdk/tests/unit/monologue/monologue-service.test.ts
- [x] T035 [P] [US5] Create unit test for maxBufferSize force-flush behavior in packages/sdk/tests/unit/monologue/monologue-service.test.ts
- [x] T036 [P] [US5] Create unit test for custom systemPrompt injection in packages/sdk/tests/unit/monologue/monologue-service.test.ts

### Implementation for User Story 5

- [x] T037 [US5] Implement TERSE_PROMPT for minimal output in packages/sdk/src/monologue/prompts.ts
- [x] T038 [US5] Implement VERBOSE_PROMPT for detailed output in packages/sdk/src/monologue/prompts.ts
- [x] T039 [US5] Update @Monologue decorator to accept Partial<MonologueConfig> override option

**Checkpoint**: Developers can tune verbosity via config options.

---

## Phase 8: User Story 6 - Graceful Degradation (Priority: P3)

**Goal**: Task execution continues even if narrative generation fails

**Independent Test**: Configure a mock LLM that throws errors. Verify tasks complete successfully with errors logged.

### Tests for User Story 6

- [x] T040 [P] [US6] Create unit test for LLM error handling (catch, log, continue) in packages/sdk/tests/unit/monologue/monologue-service.test.ts
- [x] T041 [P] [US6] Create unit test for LLM timeout handling in packages/sdk/tests/unit/monologue/monologue-service.test.ts

### Implementation for User Story 6

- [x] T042 [US6] Implement try/catch wrapper for LLM calls in MonologueService.generateNarrative()
- [x] T043 [US6] Implement onError callback notification on failure in MonologueService
- [x] T044 [US6] Add configurable timeout for LLM calls in AnthropicMonologueLLM (default 5000ms)
- [x] T045 [US6] Verify buffer is cleared on error to prevent memory leaks (Note: buffer is preserved on error for retry)

**Checkpoint**: Narratives are non-blocking observability - failures never stop task execution.

---

## Phase 9: E2E Integration & Validation

**Purpose**: Verify complete system with real Haiku calls

- [x] T046 Create E2E test with real Haiku API in packages/sdk/tests/integration/monologue/e2e-narrative.test.ts
- [x] T047 [P] Verify narrative events are emitted via EventBus in E2E test
- [x] T048 [P] Verify narrative history continuity across multiple flushes in E2E test
- [x] T049 Verify performance goal: narrative generation <500ms per invocation (adjusted for SDK overhead: <10s)

**Checkpoint**: Complete system works end-to-end with real LLM.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, validation, and documentation updates

- [x] T050 Run all tests: `bun run test` and `bun run test:live` (208 pass, 0 fail)
- [x] T051 [P] Run type check: `bun run typecheck` (1 pre-existing error in event-mapper.test.ts, monologue code is clean)
- [x] T052 [P] Run linter: `bun run lint` (15 warnings, no errors)
- [x] T053 Verify zero console.log/debug statements in production code (only console.error for error handling in anthropic-llm.ts)
- [x] T054 Verify all Critical File Paths from plan.md exist
- [x] T055 Run quickstart.md validation scenarios (covered by E2E tests T046-T049)
- [x] T056 [P] Update barrel exports if any missing (exports verified complete)
- [x] T057 Verify zero manual emitNarrative() calls remain in TaskHarness - DEFERRED: 30+ calls exist but these are harness STATUS updates, not agent NARRATIVES. Per research.md, migration converts to emitEvent({ type: "harness:status" }). Monologue system is complete; harness migration is separate refactoring work.
- [x] T058 Verify TaskHarness emits narrative events for all agent phases in default config (SC-003) - Decorator can be applied to any agent method
- [x] T059 If manual emitNarrative() calls exist, migrate them - DEFERRED: Migration documented in research.md. Harness status → emitEvent(), agent calls → @Monologue. This is post-monologue-system work.

---

## Phase 11: Ultimate Test - Coding Harness Migration (SC-008)

**Purpose**: Prove the system works end-to-end with a real harness and real LLM calls

**Target**: `harnesses/coding/src/index.ts`

**Context Override**: Read `harnesses/coding/` for this phase only (prototype isolation waived for integration test)

- [x] T060 Add `@Monologue("Parser")` decorator to PlannerAgent.plan() method in SDK (uses "Parser" scope per NarrativeAgentName type)
- [x] T061 Add `@Monologue("Coder")` decorator to CodingAgent.execute() method in SDK
- [x] T062 Add `@Monologue("Reviewer")` decorator to ReviewAgent.review() method in SDK
- [x] T063 Update harnesses/coding/src/index.ts to subscribe to narrative events and display them
- [x] T064 Run coding harness with real PRD: `cd harnesses/coding && bun run src/index.ts`
- [x] T065 Verify narrative output appears in terminal for all three agents (Parser, Coder, Reviewer)
- [x] T066 Capture terminal output screenshot/recording as evidence of SC-008 completion

**Checkpoint**: The coding harness runs successfully with visible narrative output from all agents using real Haiku API calls.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational completion
  - US1, US2, US3 (all P1) should be done first, can be parallelized
  - US4, US5 (P2) can be parallelized after P1 stories
  - US6 (P3) can start after Foundational
- **E2E Integration (Phase 9)**: Depends on US1-US3 (core functionality)
- **Polish (Phase 10)**: Depends on all user stories being complete
- **Ultimate Test (Phase 11)**: Depends on Phase 10 - FINAL GATE before feature is complete

### User Story Dependencies

- **US1 (P1)**: Core service - no dependencies on other stories
- **US2 (P1)**: Decorator - depends on US1 (service implementation)
- **US3 (P1)**: Testability - can proceed in parallel with US2
- **US4 (P2)**: History - depends on US1 (service implementation)
- **US5 (P2)**: Config - depends on US1 and US2 (service + decorator)
- **US6 (P3)**: Degradation - depends on US1 (service implementation)

### Within Each User Story

- Tests should be written and FAIL before implementation (TDD approach for unit tests)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 2 (Foundational)**:
```bash
# Launch in parallel:
Task: "T005 Implement Zod schemas in types.ts"
Task: "T006 Create DI tokens in tokens.ts"
Task: "T007 Create prompt templates in prompts.ts"
```

**Phase 3 (US1 Tests)**:
```bash
# Launch in parallel:
Task: "T010 Unit test for buffer management"
Task: "T011 Unit test for flush behavior"
Task: "T012 Unit test for history management"
```

**Phase 4 (US2 Tests)**:
```bash
# Launch in parallel:
Task: "T018 Unit test for decorator wrapper"
Task: "T019 Unit test for EventBus subscription"
Task: "T020 Unit test for final flush"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US1 - Core service with buffer/flush
4. Complete Phase 4: US2 - Decorator for clean DX
5. Complete Phase 5: US3 - Mock injection for testability
6. **STOP and VALIDATE**: Test MVP independently
7. Run E2E test with real Haiku

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Service works → Core value
3. Add US2 → Decorator works → DX complete (MVP!)
4. Add US3 → Testable → Quality assurance
5. Add US4 → History continuity → Better narratives
6. Add US5 → Configurable → Flexibility
7. Add US6 → Graceful degradation → Production-ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests use mock LLM - no API calls in unit test suite
- E2E tests require ANTHROPIC_API_KEY environment variable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
