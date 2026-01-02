---
description: "Task list for Clean DI Architecture with Agent Builder Pattern"
---

# Tasks: Clean DI Architecture with Agent Builder Pattern

**Input**: Design documents from `/specs/ready/014-clean-di-architecture/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), data-model.md, contracts/

**Tests**: Tests are NOT requested in this feature specification. All testing happens through existing test suites.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Context Manifest

<!--
  PURPOSE: Defines what context the implementing agent should access per task.
  Prevents prototype contamination by explicitly scoping file access.
-->

### Default Context Rules

> Applies to ALL tasks unless overridden in a specific phase

**Read from** (implementing agent SHOULD access):
- `specs/ready/014-clean-di-architecture/spec.md` - requirements and user stories
- `specs/ready/014-clean-di-architecture/plan.md` - implementation plan and structure
- `specs/ready/014-clean-di-architecture/data-model.md` - entity definitions
- `specs/ready/014-clean-di-architecture/contracts/` - API contracts
- `packages/sdk/src/` - SDK source code patterns
- `packages/anthropic/src/` - Anthropic provider patterns
- `.claude/skills/needle-di/` - DI best practices reference

**Do NOT read from** (prototype isolation):
- `examples/` - May contain old factory patterns to avoid
- `specs/013-anthropic-refactor/` - Previous refactor (different scope, may cause confusion)
- `specs/backlog/` - Unrelated features
- `.knowledge/private/` - Investor materials (not relevant)

### Phase-Specific Overrides

**Phase 1 (Core Infrastructure)**:
- Additional read: `packages/anthropic/src/provider/internal-agent.ts` - Understanding what builder must construct
- Additional read: `packages/anthropic/src/provider/prompt-template.ts` - Template rendering logic

**Phase 2 (Harness Integration)**:
- Additional read: `packages/sdk/src/factory/define-harness.ts` - Current harness factory logic
- Additional read: `packages/sdk/tests/harness/control-flow.test.ts` - Harness tests (must remain passing)

**Phase 3 (Preset Agents Migration)**:
- Additional read: `packages/anthropic/src/presets/` - Current preset agent implementations
- Additional read: `packages/anthropic/tests/presets.test.ts` - Preset integration tests

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Monorepo structure with `packages/sdk/` and `packages/anthropic/`
- Tests in `packages/{package}/tests/`
- Examples in `examples/coding/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and validation of approach

- [ ] T001 Review NeedleDI anti-patterns document from .claude/skills/needle-di/references/rubrics.md
- [ ] T002 Review existing InternalAnthropicAgent in packages/anthropic/src/provider/internal-agent.ts to understand builder requirements
- [ ] T003 [P] Validate agent definition serialization (create test prototype with JSON.stringify)

---

## Phase 2: Foundational (Core Builder Infrastructure)

**Purpose**: Create injectable AgentBuilder service and refactor defineAnthropicAgent() to return plain config - BLOCKS all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create packages/anthropic/src/provider/types.ts with AnthropicAgentDefinition and ExecutableAgent interfaces
- [ ] T005 Create packages/anthropic/src/provider/builder.ts with @injectable() AgentBuilder class
- [ ] T006 [P] Implement AgentBuilder.build() method that constructs ExecutableAgent with execute/stream methods
- [ ] T007 Refactor packages/anthropic/src/provider/factory.ts to return plain AnthropicAgentDefinition objects and eliminate all global container state (remove getGlobalContainer() function and _globalContainer module-level variable)
- [ ] T008 [P] Create packages/anthropic/src/provider/helpers.ts with executeAgent() function (Note: Extract shared container resolution logic with T009 into private helper to avoid duplication)
- [ ] T009 [P] Create streamAgent() function in packages/anthropic/src/provider/helpers.ts (Note: Share container resolution logic with T008 via private helper function)
- [ ] T010 [P] Implement createTemporaryContainer() helper in packages/anthropic/src/provider/helpers.ts
- [ ] T011 Update packages/anthropic/src/provider/index.ts to export new helpers and types
- [ ] T012 Verify no global containers remain using grep for "let.*Container.*=" and "getGlobalContainer"

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Standalone Agent Execution (Priority: P1) 🎯 MVP

**Goal**: Developers can execute preset agents standalone without harness for quick experimentation

**Independent Test**: Import PlannerAgent, call executeAgent() with input, receive typed output without touching DI concepts

### Implementation for User Story 1

- [ ] T013 [P] [US1] Refactor packages/anthropic/src/presets/planner-agent.ts to return config object from defineAnthropicAgent()
- [ ] T014 [P] [US1] Refactor packages/anthropic/src/presets/coding-agent.ts to return config object from defineAnthropicAgent()
- [ ] T015 [P] [US1] Refactor packages/anthropic/src/presets/review-agent.ts to return config object from defineAnthropicAgent()
- [ ] T016 [US1] Update packages/anthropic/src/presets/index.ts to export preset agent definitions
- [ ] T017 [US1] Verify executeAgent() works with PlannerAgent definition in manual test
- [ ] T018 [US1] Verify streamAgent() works with preset agents in manual test
- [ ] T019 [US1] Run preset integration tests and verify all pass (packages/anthropic/tests/presets.test.ts)

**Checkpoint**: At this point, User Story 1 should be fully functional - standalone execution works

---

## Phase 4: User Story 2 - Multi-Agent Workflow with Harness (Priority: P1)

**Goal**: Developers can orchestrate multiple agents in harness using agent definitions without seeing DI infrastructure

**Independent Test**: Define harness with multiple preset agents, run workflow, observe agents executing in sequence

### Implementation for User Story 2

- [ ] T020 [US2] Modify packages/sdk/src/factory/define-harness.ts to detect agent definitions (check for name + prompt fields)
- [ ] T021 [US2] Update harness to bind AgentBuilder to container after creation in packages/sdk/src/factory/define-harness.ts
- [ ] T022 [US2] Implement agent resolution using builder.build(agentDefinition) in packages/sdk/src/factory/define-harness.ts
- [ ] T023 [US2] Update registerAnthropicProvider() to bind AgentBuilder in packages/anthropic/src/provider/register.ts
- [ ] T024 [US2] Verify harness creates isolated container per instance (no shared state)
- [ ] T025 [US2] Run harness control-flow tests and verify all 17 tests pass (packages/sdk/tests/harness/control-flow.test.ts)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - standalone execution AND harness workflows

---

## Phase 5: User Story 3 - Custom Agent Definition (Priority: P2)

**Goal**: Developers can create custom agents using defineAnthropicAgent() with their own prompt templates and schemas

**Independent Test**: Define custom agent with typed prompt template and schemas, execute standalone or in harness

### Implementation for User Story 3

- [ ] T026 [P] [US3] Update examples/coding/src/validation-coding-agent.ts to return config object from defineAnthropicAgent()
- [ ] T027 [P] [US3] Update examples/coding/src/validation-agent.ts to return config object from defineAnthropicAgent()
- [ ] T028 [US3] Verify examples/coding/src/validate-harness.ts works without changes (should use new architecture transparently)
- [ ] T029 [US3] Verify examples/coding/src/harness.ts works without changes
- [ ] T030 [US3] Run validation workflow end-to-end: bun examples/coding/src/validate.ts
- [ ] T031 [US3] Run coding workflow end-to-end: bun examples/coding/src/index.ts

**Checkpoint**: All user stories 1-3 should now be independently functional - custom agents work like presets

---

## Phase 6: User Story 4 - Testing with Dependency Injection (Priority: P2)

**Goal**: Developers can test agents/harnesses with mock infrastructure without relying on real LLM calls

**Independent Test**: Create test container with mock bindings, pass to executeAgent(), observe mock infrastructure used

### Implementation for User Story 4

- [ ] T032 [P] [US4] Add unit test for AgentBuilder.build() with mock IAgentRunner in packages/anthropic/tests/unit/builder.test.ts
- [ ] T033 [P] [US4] Add unit test for AgentBuilder.build() with mock IUnifiedEventBus in packages/anthropic/tests/unit/builder.test.ts
- [ ] T033b [P] [US4] (Optional) Add integration test for AgentBuilder with BOTH mock runner and event bus to verify they integrate correctly
- [ ] T034 [P] [US4] Add unit test for executeAgent() with custom container option in packages/anthropic/tests/unit/helpers.test.ts
- [ ] T035 [P] [US4] Add unit test for executeAgent() with default temporary container in packages/anthropic/tests/unit/helpers.test.ts
- [ ] T036 [P] [US4] Add unit test for streamAgent() with channel attachment in packages/anthropic/tests/unit/helpers.test.ts
- [ ] T037 [US4] Add DI compliance test verifying agent definition serialization in packages/anthropic/tests/unit/compliance.test.ts
- [ ] T038 [US4] Add DI compliance test verifying no global state between tests in packages/anthropic/tests/unit/compliance.test.ts (run with --random-seed, verify each test creates isolated container, tests pass regardless of order)
- [ ] T039 [US4] Add DI compliance test verifying container isolation in harness in packages/sdk/tests/harness/di-compliance.test.ts
- [ ] T040 [US4] Run all unit tests and verify 80%+ line coverage for new code using bun test --coverage (builder.ts, helpers.ts, factory.ts)
- [ ] T041 [P] [US4] Add explicit input validation test in packages/anthropic/tests/unit/validation.test.ts verifying executeAgent() rejects invalid input with clear Zod errors (FR-010 verification)
- [ ] T042 [P] [US4] Add explicit template rendering test in packages/anthropic/tests/unit/template.test.ts verifying prompt variable substitution works correctly (FR-011 verification)
- [ ] T043 [P] [US4] Add explicit event emission integration test in packages/anthropic/tests/integration/events.test.ts verifying IUnifiedEventBus receives events during agent execution (FR-018 verification)

**Checkpoint**: All user stories should now be independently functional AND testable with mocks

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, final validation, and cleanup

- [ ] T044 [P] Update architecture documentation in .knowledge/docs/how-it-works.md with builder pattern
- [ ] T045 [P] Run DI audit using NeedleDI rubric from .claude/skills/needle-di/references/rubrics.md
- [ ] T046 Verify DI audit score >= 95% (no service locator, no global state, pure constructor injection)
- [ ] T047 Run all tests across SDK and Anthropic packages: bun test
- [ ] T048 Run type checking across all packages: bun run typecheck
- [ ] T049 Run linting across all packages: bun run lint
- [ ] T050 Verify no console.log statements in production code
- [ ] T051 [P] Verify API surface encapsulation: Run tsc --declaration on packages/anthropic/src/index.ts and grep output for Container|injectable|Token (expect zero matches)
- [ ] T052 [P] Add type safety negative test: Create test file with mismatched template/schema, verify tsc --noEmit fails with type error

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) - Standalone execution
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) and US1 (Phase 3) - Harness needs preset agents migrated
- **User Story 3 (Phase 5)**: Depends on US1 (Phase 3) and US2 (Phase 4) - Custom agents need both standalone + harness working
- **User Story 4 (Phase 6)**: Depends on all previous user stories - Testing infrastructure
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after US1 complete - Needs preset agents as config objects
- **User Story 3 (P2)**: Can start after US1 + US2 complete - Needs both execution modes working
- **User Story 4 (P2)**: Can start after all other stories - Adds testing capabilities

### Within Each User Story

- **Phase 2 (Foundational)**:
  - T004 (types) before T005-T006 (builder implementation)
  - T007 (factory refactor) can run parallel with T008-T010 (helpers)
  - T011 (exports) depends on all previous tasks
  - T012 (verification) must be last

- **Phase 3 (User Story 1)**:
  - T013-T015 (preset refactors) can run in parallel
  - T016 (exports) depends on T013-T015
  - T017-T019 (verification) must be sequential after T016

- **Phase 4 (User Story 2)**:
  - T020-T022 (harness changes) must be sequential
  - T023 (provider registration) can run parallel with T020-T022
  - T024-T025 (verification) must be after all implementation

- **Phase 5 (User Story 3)**:
  - T026-T027 (example agents) can run in parallel
  - T028-T029 (verify no changes needed) can run parallel
  - T030-T031 (end-to-end) must be sequential

- **Phase 6 (User Story 4)**:
  - T032-T036 (unit tests) can all run in parallel
  - T037-T039 (compliance tests) can run in parallel
  - T040 (coverage verification) depends on tests
  - T041-T043 (explicit verification tests) can run in parallel

- **Phase 7 (Polish & Cross-Cutting)**:
  - T044-T045 (documentation and DI audit) can run in parallel
  - T046 (audit score verification) depends on T045
  - T047-T050 (quality gates) can run in parallel
  - T051-T052 (API surface and type safety) can run in parallel

### Parallel Opportunities

- **Phase 1**: All tasks (T001-T003) can run in parallel
- **Phase 2**: T007 parallel with T008-T010 after T004-T006 complete
- **Phase 3**: T013-T015 can run in parallel
- **Phase 4**: T023 can run parallel with T020-T022
- **Phase 5**: T026-T027 parallel, T028-T029 parallel
- **Phase 6**: T032-T036 parallel, T037-T039 parallel, T041-T043 parallel
- **Phase 7**: T044-T045 parallel, T051-T052 parallel

---

## Parallel Example: User Story 1 (Preset Migration)

```bash
# Launch all preset agent refactors together:
Task: "Refactor packages/anthropic/src/presets/planner-agent.ts to return config object"
Task: "Refactor packages/anthropic/src/presets/coding-agent.ts to return config object"
Task: "Refactor packages/anthropic/src/presets/review-agent.ts to return config object"

# Then sequentially:
Task: "Update packages/anthropic/src/presets/index.ts to export preset definitions"
Task: "Verify executeAgent() works with PlannerAgent definition"
```

## Parallel Example: User Story 4 (Test Infrastructure)

```bash
# Launch all unit tests together:
Task: "Unit test for AgentBuilder.build() with mock IAgentRunner"
Task: "Unit test for AgentBuilder.build() with mock IUnifiedEventBus"
Task: "Unit test for executeAgent() with custom container"
Task: "Unit test for executeAgent() with default container"
Task: "Unit test for streamAgent() with channel attachment"

# Separate parallel batch for compliance tests:
Task: "DI compliance test for agent definition serialization"
Task: "DI compliance test for no global state between tests"
Task: "DI compliance test for container isolation in harness"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only - Both P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Standalone execution)
4. Complete Phase 4: User Story 2 (Harness workflows)
5. **STOP and VALIDATE**: Test both execution modes end-to-end
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Standalone execution works (MVP partial!)
3. Add User Story 2 → Test independently → Harness workflows work (MVP complete!)
4. Add User Story 3 → Test independently → Custom agents work
5. Add User Story 4 → Test independently → Full DI testability achieved
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Preset migration)
   - Developer B: User Story 2 (Harness integration) - starts after US1 completes
3. After US1 + US2 complete:
   - Developer A: User Story 3 (Examples)
   - Developer B: User Story 4 (Testing)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- No explicit tests in tasks (testing via existing test suites)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Critical verification points**:
  - After Phase 2: No global containers remain (grep verification)
  - After Phase 3: Preset integration tests pass (17/17)
  - After Phase 4: Harness control-flow tests pass (17/17)
  - After Phase 5: Both example workflows run end-to-end
  - After Phase 6: DI compliance audit >= 95%
