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

- [X] T001 Remove web build configuration, switch to library build in packages/sdk/package.json
- [X] T002 Create DI tokens for new subsystems in packages/sdk/src/core/tokens.ts
- [X] T003 [P] Create IAgentCallbacks interface in packages/sdk/src/callbacks/types.ts
- [X] T004 [P] Create EventBus implementation in packages/sdk/src/core/event-bus.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create BaseAnthropicAgent class in packages/sdk/src/agents/base-anthropic-agent.ts
- [X] T006 Migrate CodingAgent to extend BaseAnthropicAgent in packages/sdk/src/agents/coding-agent.ts
- [X] T007 [P] Migrate ReviewAgent to extend BaseAnthropicAgent in packages/sdk/src/agents/review-agent.ts
- [X] T008 [P] Migrate PlannerAgent to extend BaseAnthropicAgent in packages/sdk/src/agents/planner-agent.ts
- [X] T009 [depends: T006,T007,T008] Clean up imports from deprecated runner/base-agent.ts
- [X] T010 Update agent-factory.ts to use new BaseAnthropicAgent in packages/sdk/src/factory/agent-factory.ts
- [X] T011 Update container.ts composition root with new bindings in packages/sdk/src/core/container.ts
- [X] T012 Remove deprecated StreamCallbacks from exports in packages/sdk/src/index.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Agent Execution (Priority: P1)

**Goal**: Create an agent that executes tasks with an LLM and returns structured output with typed callbacks

**Independent Test**: Can create an agent, run it with a prompt, receive callbacks during execution, and get typed output

### Implementation for User Story 1

- [X] T013 [US1] Implement createAgent() factory function in packages/sdk/src/factory/agent-factory.ts
- [X] T014 [US1] Implement full callback system (onText, onToolCall, onToolResult, onError) + EventBus integration in packages/sdk/src/agents/base-anthropic-agent.ts
- [X] T015 [US1] Implement typed CodingResult output in packages/sdk/src/agents/coding-agent.ts
- [X] T016 [US1] Export createAgent and CodingResult from packages/sdk/src/index.ts

**Checkpoint**: User Story 1 complete - basic agent execution works with typed callbacks

---

## Phase 4: User Story 2 - Recording/Replay for TDD (Priority: P1)

**Goal**: Record real LLM interactions and replay them for fast deterministic tests

**Independent Test**: Can record a session to JSONL, then replay it with identical callback sequence

### Implementation for User Story 2

- [X] T019 [P] [US2] Create recording types (RecordedSession) in packages/sdk/src/core/tokens.ts
- [X] T020 [P] [US2] Recording functionality in packages/sdk/src/core/recording-factory.ts
- [X] T021 [US2] Implement Recorder class for capturing sessions in packages/sdk/src/core/recording-factory.ts
- [X] T022 [US2] Implement ReplayRunner for playback in packages/sdk/src/core/replay-runner.ts
- [X] T023 [US2] Vault for session storage in packages/sdk/src/core/vault.ts
- [X] T024 [US2] Add mode: "live" | "replay" to container options in packages/sdk/src/core/container.ts
- [X] T025 [US2] RecordingFactory binding in container.ts
- [ ] T026 [US2] Create recordings/golden/ directory structure
- [X] T027 [US2] Export recording types from packages/sdk/src/index.ts
- [ ] T027a [US2] Implement replay strict mode option (error when prompt doesn't match)
- [ ] T027b [US2] [CONSTITUTION-II] Add validation ensuring all recordings are from live API calls

**Checkpoint**: User Story 2 complete - can record and replay agent sessions

---

## Phase 5: User Story 3 - Monologue Subscription (Priority: P2)

**Goal**: Subscribe to first-person narrative of agent actions for human-readable progress

**Independent Test**: Can wrap agent with monologue, receive narrative updates describing agent actions in plain English

### Implementation for User Story 3

- [X] T028 [P] [US3] Monologue types (MonologueConfig) in packages/sdk/src/monologue/wrapper.ts
- [X] T029 [P] [US3] AgentMonologue class in packages/sdk/src/agents/monologue.ts
- [ ] T030 [P] [US3] Create monologue.md prompt template in packages/sdk/prompts/monologue.md
- [X] T031 [US3] Implement withMonologue wrapper with buffer in packages/sdk/src/monologue/wrapper.ts
- [X] T032 [US3] MonologueWrappedAgent with IAgentCallbacks in packages/sdk/src/monologue/wrapper.ts
- [X] T033 [US3] Buffer size heuristics in packages/sdk/src/monologue/wrapper.ts
- [X] T034 [US3] withMonologue factory function exported
- [X] T035 [US3] onNarrative callback in IAgentCallbacks in packages/sdk/src/callbacks/types.ts
- [X] T036 [US3] Export withMonologue from packages/sdk/src/index.ts

**Checkpoint**: User Story 3 complete - agents can emit human-readable narratives

---

## Phase 6: User Story 4 - Multi-Agent Workflows (Priority: P2)

**Goal**: Orchestrate multiple agents working together in pipelines

**Independent Test**: Can create workflow with multiple agents, execute in sequence, pass outputs between agents

### Implementation for User Story 4

- [X] T037 [P] [US4] Workflow types (WorkflowConfig, WorkflowState) in packages/sdk/src/factory/workflow-builder.ts
- [X] T038 [US4] Orchestrator for sequential agent execution in packages/sdk/src/workflow/orchestrator.ts
- [X] T039 [US4] Context passing between agents in workflow-builder.ts
- [X] T040 [US4] Failure handling in packages/sdk/src/workflow/orchestrator.ts
- [X] T041 [US4] createWorkflow() factory function in packages/sdk/src/factory/workflow-builder.ts
- [X] T042 [US4] Export createWorkflow from packages/sdk/src/index.ts

**Checkpoint**: User Story 4 complete - can orchestrate multi-agent workflows

---

## Phase 7: User Story 5 - Provider Abstraction (Priority: P3)

**Goal**: Swap LLM providers without changing agent code

**Independent Test**: Can implement custom runner, inject via DI, and agent works without modification

### Implementation for User Story 5

- [X] T043 [P] [US5] IAgentRunner interface in packages/sdk/src/core/tokens.ts
- [X] T044 [P] [US5] IAgentRunnerToken + IAnthropicRunnerToken in packages/sdk/src/core/tokens.ts
- [X] T045 [US5] AnthropicRunner implements IAgentRunner in packages/sdk/src/runner/anthropic-runner.ts
- [X] T046 [US5] ReplayRunner implementing IAgentRunner in packages/sdk/src/core/replay-runner.ts
- [X] T047 [US5] Agents depend on IAnthropicRunnerToken in packages/sdk/src/agents/base-anthropic-agent.ts
- [X] T048 [US5] Container.ts with runner token bindings in packages/sdk/src/core/container.ts
- [X] T049 [US5] Export IAgentRunner interface from packages/sdk/src/index.ts
- [ ] T049a [US5] Validate: Test agent with swapped runner (ReplayRunner) without modifying agent code

**Checkpoint**: User Story 5 complete - runners are swappable via DI

---

## Phase 8: User Story 6 - Step-Aware Harness (Priority: P3)

**Goal**: Run long-running agent tasks with bounded context and state management

**Independent Test**: Can create harness, execute multi-step workflow, state persists between steps, context is bounded

### Implementation for User Story 6

- [X] T050 [US6] BaseHarness with step configuration in packages/sdk/src/harness/base-harness.ts
- [X] T051 [US6] Step history in packages/sdk/src/harness/base-harness.ts
- [X] T052 [US6] PersistentState for state management in packages/sdk/src/harness/state.ts
- [X] T053 [US6] loadContext() for agent context in packages/sdk/src/harness/base-harness.ts
- [X] T054 [US6] Harness types in packages/sdk/src/harness/types.ts
- [X] T055 [US6] Export harness types from packages/sdk/src/index.ts

**Checkpoint**: User Story 6 complete - harness provides bounded context

---

## Phase 9: Prompt System (Cross-Cutting)

**Purpose**: Prompt templating system used by all agents

- [X] T056 [P] Prompt types in packages/sdk/src/runner/prompts.ts
- [X] T057 [P] CodingResult/ReviewResult schemas in respective agent files
- [X] T058 Add handlebars dependency in packages/sdk/package.json
- [X] T059 PromptRegistry in packages/sdk/src/runner/prompts.ts
- [X] T060 [P] coder.prompt.md in packages/sdk/src/agents/coder.prompt.md
- [X] T061 [P] reviewer.prompt.md in packages/sdk/src/agents/reviewer.prompt.md
- [X] T062 [P] planner.prompt.md in packages/sdk/src/agents/planner.prompt.md
- [X] T063 PromptRegistry integrated with agents
- [ ] T064 Export PromptRegistry from packages/sdk/src/index.ts

---

## Phase 10: Polish & Validation

**Purpose**: Final validation and cleanup

- [ ] T065 Verify bun run build succeeds with zero errors
- [ ] T066 Verify bun run check-types passes with strict mode
- [ ] T067 Verify all exports in index.ts resolve to existing implementations
- [ ] T068 [P] Capture 3 golden recordings: coding-simple.jsonl, workflow-basic.jsonl, monologue-demo.jsonl in recordings/golden/
- [ ] T069 Verify no any types in public API surface
- [ ] T070 Remove any remaining deprecated code references
- [ ] T071 Validate DX: new user can create and run agent in <10 lines
- [ ] T072 Implement timeout configuration (per-agent + per-workflow) in packages/sdk/src/agents/base-anthropic-agent.ts and packages/sdk/src/workflow/orchestrator.ts
- [ ] T073 Add container binding validation on creation (fail-fast for missing bindings) in packages/sdk/src/core/container.ts

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
