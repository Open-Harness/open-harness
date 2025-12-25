# Tasks: Open Harness SDK Core

**Input**: Design documents from `/specs/001-sdk-core/`
**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: No test tasks included (not explicitly requested). Add test phases if TDD approach is desired.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure:
- **SDK source**: `packages/sdk/src/`
- **Prompts**: `packages/sdk/prompts/`
- **Recordings**: `recordings/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Fix broken build and create base infrastructure

- [ ] T001 Remove web build configuration, switch to library build in packages/sdk/package.json
- [ ] T002 Create DI tokens for new subsystems in packages/sdk/src/core/tokens.ts
- [ ] T003 [P] Create IAgentCallbacks interface in packages/sdk/src/callbacks/types.ts
- [ ] T004 [P] Create EventBus implementation in packages/sdk/src/core/event-bus.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create BaseAnthropicAgent class in packages/sdk/src/agents/base-anthropic-agent.ts
- [ ] T006 Migrate CodingAgent to extend BaseAnthropicAgent in packages/sdk/src/agents/coding-agent.ts
- [ ] T007 [P] Migrate ReviewAgent to extend BaseAnthropicAgent in packages/sdk/src/agents/review-agent.ts
- [ ] T008 [P] Migrate PlannerAgent to extend BaseAnthropicAgent in packages/sdk/src/agents/planner-agent.ts
- [ ] T009 Delete deprecated runner/base-agent.ts after migrations complete
- [ ] T010 Update agent-factory.ts to use new BaseAnthropicAgent in packages/sdk/src/factory/agent-factory.ts
- [ ] T011 Update container.ts composition root with new bindings in packages/sdk/src/core/container.ts
- [ ] T012 Remove deprecated StreamCallbacks from exports in packages/sdk/src/index.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Agent Execution (Priority: P1)

**Goal**: Create an agent that executes tasks with an LLM and returns structured output with typed callbacks

**Independent Test**: Can create an agent, run it with a prompt, receive callbacks during execution, and get typed output

### Implementation for User Story 1

- [ ] T013 [US1] Implement createAgent() factory function in packages/sdk/src/factory/agent-factory.ts
- [ ] T014 [US1] Add onText, onToolCall, onToolResult callbacks to BaseAnthropicAgent in packages/sdk/src/agents/base-anthropic-agent.ts
- [ ] T015 [US1] Implement typed CodingResult output in packages/sdk/src/agents/coding-agent.ts
- [ ] T016 [US1] Add onError callback with error details in packages/sdk/src/agents/base-anthropic-agent.ts
- [ ] T017 [US1] Integrate EventBus for cross-cutting event emission in packages/sdk/src/agents/base-anthropic-agent.ts
- [ ] T018 [US1] Export createAgent and CodingResult from packages/sdk/src/index.ts

**Checkpoint**: User Story 1 complete - basic agent execution works with typed callbacks

---

## Phase 4: User Story 2 - Recording/Replay for TDD (Priority: P1)

**Goal**: Record real LLM interactions and replay them for fast deterministic tests

**Independent Test**: Can record a session to JSONL, then replay it with identical callback sequence

### Implementation for User Story 2

- [ ] T019 [P] [US2] Create recording types (RecordedSession, RecordedEvent) in packages/sdk/src/recording/types.ts
- [ ] T020 [P] [US2] Create recording module index in packages/sdk/src/recording/index.ts
- [ ] T021 [US2] Implement Recorder class for capturing sessions in packages/sdk/src/recording/recorder.ts
- [ ] T022 [US2] Implement Replayer class for playback in packages/sdk/src/recording/replayer.ts
- [ ] T023 [US2] Create injectable RecordingDecorator in packages/sdk/src/recording/decorator.ts
- [ ] T024 [US2] Add mode: "live" | "replay" to container options in packages/sdk/src/core/container.ts
- [ ] T025 [US2] Integrate RecordingDecorator with agent factory in packages/sdk/src/factory/agent-factory.ts
- [ ] T026 [US2] Create recordings/golden/ directory structure
- [ ] T027 [US2] Export recording types and decorator from packages/sdk/src/index.ts

**Checkpoint**: User Story 2 complete - can record and replay agent sessions

---

## Phase 5: User Story 3 - Monologue Subscription (Priority: P2)

**Goal**: Subscribe to first-person narrative of agent actions for human-readable progress

**Independent Test**: Can wrap agent with monologue, receive narrative updates describing agent actions in plain English

### Implementation for User Story 3

- [ ] T028 [P] [US3] Create monologue types (MonologueState, MonologueConfig) in packages/sdk/src/monologue/types.ts
- [ ] T029 [P] [US3] Create monologue module index in packages/sdk/src/monologue/index.ts
- [ ] T030 [P] [US3] Create monologue.md prompt template in packages/sdk/prompts/monologue.md
- [ ] T031 [US3] Implement core Monologue class with buffer and history in packages/sdk/src/monologue/monologue.ts
- [ ] T032 [US3] Create injectable MonologueDecorator in packages/sdk/src/monologue/decorator.ts
- [ ] T033 [US3] Add shouldEmit() heuristics (buffer size, time, event type) in packages/sdk/src/monologue/monologue.ts
- [ ] T034 [US3] Integrate MonologueDecorator with agent factory in packages/sdk/src/factory/agent-factory.ts
- [ ] T035 [US3] Add onMonologue callback to IAgentCallbacks in packages/sdk/src/callbacks/types.ts
- [ ] T036 [US3] Export monologue types and decorator from packages/sdk/src/index.ts

**Checkpoint**: User Story 3 complete - agents can emit human-readable narratives

---

## Phase 6: User Story 4 - Multi-Agent Workflows (Priority: P2)

**Goal**: Orchestrate multiple agents working together in pipelines

**Independent Test**: Can create workflow with multiple agents, execute in sequence, pass outputs between agents

### Implementation for User Story 4

- [ ] T037 [P] [US4] Create workflow types (WorkflowConfig, WorkflowResult) in packages/sdk/src/workflow/types.ts
- [ ] T038 [US4] Implement Orchestrator for sequential agent execution in packages/sdk/src/workflow/orchestrator.ts
- [ ] T039 [US4] Add context passing between agents in workflow in packages/sdk/src/workflow/orchestrator.ts
- [ ] T040 [US4] Implement failure handling (stop on error, continue, retry) in packages/sdk/src/workflow/orchestrator.ts
- [ ] T041 [US4] Create createWorkflow() factory function in packages/sdk/src/factory/workflow-builder.ts
- [ ] T042 [US4] Export workflow types and createWorkflow from packages/sdk/src/index.ts

**Checkpoint**: User Story 4 complete - can orchestrate multi-agent workflows

---

## Phase 7: User Story 5 - Provider Abstraction (Priority: P3)

**Goal**: Swap LLM providers without changing agent code

**Independent Test**: Can implement custom runner, inject via DI, and agent works without modification

### Implementation for User Story 5

- [ ] T043 [P] [US5] Define IAgentRunner interface in packages/sdk/src/runner/types.ts
- [ ] T044 [P] [US5] Create IAgentRunnerToken in packages/sdk/src/core/tokens.ts
- [ ] T045 [US5] Refactor AnthropicRunner to implement IAgentRunner in packages/sdk/src/runner/anthropic-runner.ts
- [ ] T046 [US5] Create ReplayRunner implementing IAgentRunner in packages/sdk/src/runner/replay-runner.ts
- [ ] T047 [US5] Update agents to depend on IAgentRunnerToken not concrete class in packages/sdk/src/agents/base-anthropic-agent.ts
- [ ] T048 [US5] Update container.ts with runner token binding in packages/sdk/src/core/container.ts
- [ ] T049 [US5] Export IAgentRunner interface from packages/sdk/src/index.ts

**Checkpoint**: User Story 5 complete - runners are swappable via DI

---

## Phase 8: User Story 6 - Step-Aware Harness (Priority: P3)

**Goal**: Run long-running agent tasks with bounded context and state management

**Independent Test**: Can create harness, execute multi-step workflow, state persists between steps, context is bounded

### Implementation for User Story 6

- [ ] T050 [US6] Add maxContextSteps configuration to BaseHarness in packages/sdk/src/harness/base-harness.ts
- [ ] T051 [US6] Implement step history bounding (keep only recent N steps) in packages/sdk/src/harness/base-harness.ts
- [ ] T052 [US6] Implement updateState(patch) for immutable state updates in packages/sdk/src/harness/state.ts
- [ ] T053 [US6] Implement loadContext() to provide state + recent steps to agent in packages/sdk/src/harness/base-harness.ts
- [ ] T054 [US6] Add contextSchema validation to harness in packages/sdk/src/harness/types.ts
- [ ] T055 [US6] Export harness types from packages/sdk/src/index.ts

**Checkpoint**: User Story 6 complete - harness provides bounded context

---

## Phase 9: Prompt System (Cross-Cutting)

**Purpose**: Prompt templating system used by all agents

- [ ] T056 [P] Create prompt types (CodingPromptParams, etc.) in packages/sdk/src/prompts/types.ts
- [ ] T057 [P] Create prompt schemas with Zod in packages/sdk/src/prompts/schemas.ts
- [ ] T058 Add handlebars dependency in packages/sdk/package.json
- [ ] T059 Implement PromptRegistry singleton in packages/sdk/src/prompts/registry.ts
- [ ] T060 [P] Create coding.md prompt template in packages/sdk/prompts/coding.md
- [ ] T061 [P] Create review.md prompt template in packages/sdk/prompts/review.md
- [ ] T062 [P] Create planner.md prompt template in packages/sdk/prompts/planner.md
- [ ] T063 Integrate PromptRegistry with agents in packages/sdk/src/agents/base-anthropic-agent.ts
- [ ] T064 Export PromptRegistry from packages/sdk/src/index.ts

---

## Phase 10: Polish & Validation

**Purpose**: Final validation and cleanup

- [ ] T065 Verify bun run build succeeds with zero errors
- [ ] T066 Verify bun run check-types passes with strict mode
- [ ] T067 Verify all exports in index.ts resolve to existing implementations
- [ ] T068 [P] Capture at least 3 golden recordings in recordings/golden/
- [ ] T069 Verify no any types in public API surface
- [ ] T070 Remove any remaining deprecated code references
- [ ] T071 Validate DX: new user can create and run agent in <10 lines

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-8)**: All depend on Foundational phase completion
  - P1 stories (US1, US2) should complete first
  - P2 stories (US3, US4) can follow
  - P3 stories (US5, US6) can follow
- **Prompt System (Phase 9)**: Can run in parallel with user stories after Foundation
- **Polish (Phase 10)**: Depends on all phases being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational - May integrate with US1 but independently testable
- **User Story 4 (P2)**: Depends on US1 (needs working agents to orchestrate)
- **User Story 5 (P3)**: Can start after Foundational - No dependencies on other stories
- **User Story 6 (P3)**: Can start after Foundational - No dependencies on other stories

### Within Each User Story

- Types before implementations
- Core classes before decorators
- Decorators before factory integration
- Factory integration before exports
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1-2 (Foundation)**:
```bash
# Can run in parallel:
Task: "Create IAgentCallbacks interface" (T003)
Task: "Create EventBus implementation" (T004)

# Can run in parallel after T005:
Task: "Migrate ReviewAgent" (T007)
Task: "Migrate PlannerAgent" (T008)
```

**Phase 4 (User Story 2)**:
```bash
# Can run in parallel:
Task: "Create recording types" (T019)
Task: "Create recording module index" (T020)
```

**Phase 5 (User Story 3)**:
```bash
# Can run in parallel:
Task: "Create monologue types" (T028)
Task: "Create monologue module index" (T029)
Task: "Create monologue.md prompt template" (T030)
```

**Phase 9 (Prompt System)**:
```bash
# Can run in parallel:
Task: "Create prompt types" (T056)
Task: "Create prompt schemas" (T057)

# Can run in parallel:
Task: "Create coding.md" (T060)
Task: "Create review.md" (T061)
Task: "Create planner.md" (T062)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Agent Execution)
4. Complete Phase 4: User Story 2 (Recording/Replay)
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy/demo if ready - this is the core TDD workflow

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 -> Test independently -> Basic agent works
3. Add User Story 2 -> Test independently -> Recording/Replay works (MVP!)
4. Add User Story 3 -> Test independently -> Monologue narratives
5. Add User Story 4 -> Test independently -> Multi-agent workflows
6. Add User Story 5 -> Test independently -> Provider swapping
7. Add User Story 6 -> Test independently -> Bounded context harness
8. Each story adds value without breaking previous stories

### Suggested MVP Scope

**Minimum Viable Product: User Stories 1 + 2**
- Agent execution with typed callbacks
- Recording/replay for TDD

This provides the core value proposition: agents that can be tested deterministically.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Prompt System (Phase 9) can run alongside user stories after Foundation
