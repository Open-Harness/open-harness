# Tasks: SDK Validation via Speckit Dogfooding

**Input**: Design documents from `/specs/002-sdk-validation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Validation**: Run `/speckit.analyze` after generating this file to check consistency

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and packages/sdk/ structure validation

- [ ] T001 Verify packages/sdk/ directory exists with proper structure per plan.md
- [ ] T002 [P] Verify tsconfig.json has strict mode enabled
- [ ] T003 [P] Verify package.json has required dependencies (@anthropic-ai/claude-agent-sdk, @needle-di/core, zod)
- [ ] T004 [P] Create recordings/harness/golden/ directory for golden recordings
- [ ] T005 Extend packages/sdk/src/core/tokens.ts with ParserAgent and TaskHarness DI tokens

### Phase 1 Validation

- [ ] T006 Run `bun run lint` (biome) and fix any errors
- [ ] T007 Run `bun run typecheck` (tsc --noEmit) and fix any errors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Define Zod schemas for ParsedTask, TaskFlags, PhaseInfo in packages/sdk/src/harness/types.ts
- [ ] T009 [P] Define Zod schemas for TaskResult, ValidationResult, FailureRecord in packages/sdk/src/harness/types.ts
- [ ] T010 [P] Define Zod schemas for ParserAgentInput, ParserAgentOutput, ParserMetadata in packages/sdk/src/harness/types.ts
- [ ] T011 [P] Define Zod schemas for CodingAgentInput, CodingAgentOutput, CodingAction in packages/sdk/src/harness/types.ts
- [ ] T012 [P] Define Zod schemas for ReviewAgentInput, ReviewAgentOutput, ValidationCheck in packages/sdk/src/harness/types.ts
- [ ] T013 [P] Define Zod schemas for TaskHarnessConfig, TaskHarnessState, NarrativeEntry in packages/sdk/src/harness/types.ts
- [ ] T014 [P] Define Zod schema for AgentAbortSignal, RetryRecord in packages/sdk/src/harness/types.ts
- [ ] T015 Export all types from packages/sdk/src/harness/types.ts with proper TypeScript inference (z.infer)
- [ ] T016 Register new DI bindings in packages/sdk/src/core/container.ts for ParserAgent and TaskHarness tokens
- [ ] T017 [P] Add JSDoc documentation for all Zod schemas in packages/sdk/src/harness/types.ts

### Phase 2 Validation

- [ ] T018 Run `bun run lint` (biome) and fix any errors
- [ ] T019 Run `bun run typecheck` (tsc --noEmit) and fix any errors

**Checkpoint**: Foundation ready - Zod schemas defined, DI tokens registered, types documented

---

## Phase 3: User Story 1 - Task Parser Agent (Priority: P1) - MVP

**Goal**: An agent that converts tasks.md into a structured task list with inferred validation criteria

**Independent Test**: Given a tasks.md file, Parser Agent returns a JSON array of tasks with validation criteria derived from task content

### Implementation for User Story 1

- [ ] T020 [US1] Create parser agent prompt template in packages/sdk/prompts/parser.md with:
  - Instructions for parsing markdown task format
  - Schema reference for structured output (ParsedTask[])
  - Examples of tasks.md format
  - Rules for inferring validation criteria from "Independent Test" sections
- [ ] T021 [US1] Create ParserAgent class extending BaseAnthropicAgent in packages/sdk/src/agents/parser-agent.ts
  - Accept markdown file path and content
  - Return ParserAgentOutput with structured output validation
  - Use Zod schema for type-safe output
- [ ] T022 [US1] Implement task parsing logic in ParserAgent:
  - Extract task ID, phase, description, userStory
  - Extract filePaths from task description (paths like `src/`, `packages/`, file extensions)
  - Parse dependencies from task text (e.g., "depends on T006")
  - Capture status from checkbox markers ([X] vs [ ])
  - Parse flags ([P] for parallel, [Story] labels)
- [ ] T023 [US1] Implement validation criteria inference in ParserAgent:
  - Extract from "Independent Test" sections when present
  - Infer from task purpose/description when not present
- [ ] T024 [US1] Implement dependency cycle detection using Kahn's algorithm in packages/sdk/src/harness/dependency-resolver.ts
- [ ] T025 [US1] Add phase parsing logic to extract PhaseInfo (number, name, purpose, goal, independentTest)
- [ ] T026 [US1] Add warnings collection for parsing issues (unknown dependencies, malformed tasks)
- [ ] T027 [US1] Export ParserAgent from packages/sdk/src/index.ts
- [ ] T028 [US1] [P] Add JSDoc documentation for ParserAgent class and public methods
- [ ] T028a [US1] Create recorder-based test for ParserAgent in packages/sdk/tests/unit/parser-agent.test.ts:
  - Capture golden recording from real LLM parsing of sample tasks.md
  - Test structured output validation against Zod schema
  - Store recording in recordings/golden/parser-agent/

### Phase 3 Validation

- [ ] T029 Run `bun run lint` (biome) and fix any errors
- [ ] T030 Run `bun run typecheck` (tsc --noEmit) and fix any errors

**Checkpoint**: Parser Agent complete - can parse tasks.md into structured ParsedTask[]

---

## Phase 4: User Story 2 - Task Execution Harness (Priority: P1) - MVP

**Goal**: A harness that iterates through parsed tasks, feeding each to a Coding Agent with state tracking

**Independent Test**: Given a parsed task list, harness executes each pending task via Coding Agent and tracks completion state

### Implementation for User Story 2

- [ ] T031 [US2] Create TaskHarnessState management in packages/sdk/src/harness/task-state.ts:
  - Track tasks, taskQueue, currentTaskId
  - Manage completedTasks, validatedTasks, failedTasks Maps
  - Track retryHistory per task
- [ ] T032 [US2] Implement topological sort for task execution order using Kahn's algorithm in packages/sdk/src/harness/dependency-resolver.ts:
  - Build adjacency list from task dependencies
  - Track in-degree for each task
  - Detect cycles during sorting
- [ ] T033 [US2] Create TaskHarness class extending BaseHarness in packages/sdk/src/harness/task-harness.ts:
  - TState = TaskHarnessState
  - TInput = ParsedTask
  - TOutput = TaskExecutionResult
- [ ] T034 [US2] Implement harness.run() method:
  - Call ParserAgent to get structured tasks
  - Execute tasks in dependency order via Coding Agent
  - Update state after each task
  - Stop on first failure (fail-fast default)
- [ ] T035 [US2] Implement resume mode in TaskHarness:
  - Skip tasks marked complete ([X])
  - Continue from checkpoint using resumeFromCheckpoint config
- [ ] T036 [US2] Implement per-task timeout with configurable default (5 min) in TaskHarness
- [ ] T037 [US2] Implement exponential backoff for API rate limits:
  - Base delay 1000ms, max 60000ms
  - Jitter 0-500ms random
  - Max 10 attempts before failure
- [ ] T038 [US2] Implement TaskHarnessCallbacks for event notifications:
  - onTasksParsed, onTaskStart, onTaskComplete
  - onTaskFailed, onComplete
- [ ] T039 [US2] Export TaskHarness from packages/sdk/src/index.ts
- [ ] T040 [US2] [P] Add JSDoc documentation for TaskHarness class and public methods
- [ ] T040a [US2] Create unit test for dependency-resolver.ts (pure logic, no LLM) in packages/sdk/tests/unit/dependency-resolver.test.ts:
  - Test topological sort with various dependency graphs
  - Test cycle detection
- [ ] T040b [US2] Create unit test for exponential backoff logic in packages/sdk/tests/unit/backoff.test.ts:
  - Test delay calculation: base * 2^attempt
  - Test max delay cap (60s)
  - Test jitter range (0-500ms)
- [ ] T040c [US2] Create recorder-based integration test for TaskHarness in packages/sdk/tests/integration/task-harness.test.ts:
  - Capture golden recording of harness executing 3 tasks
  - Test state transitions (pending → in-progress → complete → validated)
  - Store recording in recordings/golden/task-harness/

### Phase 4 Validation

- [ ] T041 Run `bun run lint` (biome) and fix any errors
- [ ] T042 Run `bun run typecheck` (tsc --noEmit) and fix any errors

**Checkpoint**: Task Harness complete - can execute parsed tasks via Coding Agent with state tracking

---

## Phase 5: User Story 3 - Task Validation via Review Agent (Priority: P1) - MVP

**Goal**: Each completed task is validated by a Review Agent using parsed validation criteria

**Independent Test**: After Coding Agent completes a task, Review Agent checks the work against validation criteria and returns pass/fail

### Implementation for User Story 3

- [ ] T043 [US3] Create review agent prompt template in packages/sdk/prompts/reviewer.md with:
  - Instructions for validating task completion
  - Schema for validation output (ReviewAgentOutput)
  - Rules for checking against validation criteria
  - Confidence scoring guidelines
- [ ] T044 [US3] Integrate Review Agent validation into TaskHarness:
  - After CodingAgent completes, call ReviewAgent
  - Pass task description, validation criteria, coding result
  - Return pass/fail with reasoning
- [ ] T045 [US3] Implement validation result handling in TaskHarness:
  - Mark task [V]alidated if passed
  - Record failure reason and suggested fixes if failed
- [ ] T046 [US3] Implement retry loop in TaskHarness:
  - On validation failure, feed feedback to Coding Agent
  - Track attempts in retryHistory
  - Support abort signal from agent when retrying is futile
- [ ] T047 [US3] Add continueOnFailure mode to TaskHarness config:
  - Default: fail-fast (stop on first failure)
  - Optional: continue mode (record failure, proceed)
- [ ] T048 [US3] [P] Add JSDoc documentation for Review Agent integration
- [ ] T048a [US3] Create recorder-based test for Review Agent validation in packages/sdk/tests/integration/review-validation.test.ts:
  - Capture golden recording of validation pass scenario
  - Capture golden recording of validation fail + retry scenario
  - Test retry loop with abort signal
  - Store recordings in recordings/golden/review-agent/

### Phase 5 Validation

- [ ] T049 Run `bun run lint` (biome) and fix any errors
- [ ] T050 Run `bun run typecheck` (tsc --noEmit) and fix any errors

**Checkpoint**: Review Agent integrated - tasks are validated, not just code-complete

---

## Phase 6: User Story 4 - Monologue Integration (Priority: P2)

**Goal**: All agents narrate their work in first-person, creating a coherent story

**Independent Test**: During harness execution, each agent emits onNarrative callbacks describing its actions in plain English

### Implementation for User Story 4

- [ ] T051 [US4] Create monologue prompt template in packages/sdk/prompts/monologue.md (if not exists):
  - First-person narrative style
  - Progress updates for file operations
  - Decision explanations
- [ ] T052 [US4] Wrap ParserAgent with monologue in packages/sdk/src/agents/parser-agent.ts:
  - Narrate: "I'm reading through the tasks file..."
  - Narrate: "Found X tasks across Y phases..."
  - Narrate discovery of phases, tasks, validation criteria
- [ ] T053 [US4] Wrap CodingAgent with monologue for task execution:
  - Narrate: "Working on T0XX now..."
  - Narrate file operations and decisions
  - Narrate completion
- [ ] T054 [US4] Wrap ReviewAgent with monologue for validation:
  - Narrate: "Checking if T0XX is complete..."
  - Narrate what is being checked
  - Narrate pass/fail reasoning
- [ ] T055 [US4] Implement narrative aggregation in TaskHarness:
  - Route all agent narratives via onNarrative callback
  - Add agent context: "[Parser] ...", "[Coder] ...", "[Reviewer] ..."
  - Inject transition narratives: "Now moving to review..."
- [ ] T056 [US4] Add harness-level narrative emissions:
  - "Starting execution of X pending tasks"
  - "Task T0XX validated successfully"
  - "Execution complete: X/Y tasks validated"

### Phase 6 Validation

- [ ] T057 Run `bun run lint` (biome) and fix any errors
- [ ] T058 Run `bun run typecheck` (tsc --noEmit) and fix any errors

**Checkpoint**: Unified narrative stream - all agents tell coherent story

---

## Phase 7: User Story 5 - Recording/Replay for Harness (Priority: P2)

**Goal**: Record a full harness run and replay it deterministically

**Independent Test**: Record a harness run to files, then replay it with identical task progression and validation results

### Implementation for User Story 5

- [ ] T059 [US5] Implement recording mode in TaskHarness:
  - Capture all agent sessions to recordings/harness/{sessionId}/
  - One file per agent call
  - Use JSONL format consistent with existing recording pattern
- [ ] T060 [US5] Implement state persistence in JSONL format:
  - Append-only file at recordings/harness/{sessionId}/state.jsonl
  - One line per state change: { timestamp, event, state_snapshot }
  - Events: task_started, task_completed, task_failed, task_validated
- [ ] T061 [US5] Implement replay mode in TaskHarness:
  - Load recorded sessions
  - Use recorded responses instead of live API calls
  - Emit identical narratives
- [ ] T062 [US5] Create HarnessRun entity for complete session capture:
  - sessionId, startTime, endTime
  - tasksFile path, final state snapshot
  - recordings array, narratives array
- [ ] T063 [US5] Implement checkpoint resume from state.jsonl:
  - Parse JSONL to reconstruct state
  - Skip already-validated tasks
  - Continue from last point

### Phase 7 Validation

- [ ] T064 Run `bun run lint` (biome) and fix any errors
- [ ] T065 Run `bun run typecheck` (tsc --noEmit) and fix any errors

**Checkpoint**: Recording/Replay complete - harness runs can be captured and replayed

---

## Phase 8: Factory & Public API

**Purpose**: Clean factory function for creating task harness

- [ ] T066 Create createTaskHarness() factory function in packages/sdk/src/factory/harness-factory.ts:
  - Accept TaskHarnessConfig
  - Handle DI container setup internally
  - Return TaskHarness interface
- [ ] T067 Export createTaskHarness from packages/sdk/src/index.ts
- [ ] T068 [P] Add JSDoc documentation for createTaskHarness factory function
- [ ] T069 Verify quickstart.md examples work with implemented API

### Phase 8 Validation

- [ ] T070 Run `bun run lint` (biome) and fix any errors
- [ ] T071 Run `bun run typecheck` (tsc --noEmit) and fix any errors

---

## Phase 9: Documentation

**Purpose**: Comprehensive documentation for the harness module

- [ ] T072 [P] Update packages/sdk/README.md with Task Harness usage section
- [ ] T073 [P] Add API reference documentation for all public exports in packages/sdk/docs/api.md
- [ ] T074 [P] Create packages/sdk/docs/harness-guide.md with:
  - Architecture overview
  - Configuration options
  - Recording/replay workflow
  - Troubleshooting guide
- [ ] T075 Add inline code examples in JSDoc comments for key classes

### Phase 9 Validation

- [ ] T076 Run `bun run lint` (biome) and fix any errors
- [ ] T077 Run `bun run typecheck` (tsc --noEmit) and fix any errors

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T078 [P] Add edge case handling in ParserAgent:
  - Malformed markdown → error with line number
  - Unknown dependency → warning in output
  - Dependency cycle → detect and report before execution
- [ ] T079 [P] Add error handling in TaskHarness:
  - File not found → clear error message
  - Task timeout → mark failed with timeout reason
  - API rate limit exhausted → fail with backoff details
- [ ] T080 Code cleanup and type safety review across harness module
- [ ] T081 [P] Run quickstart.md scenarios as integration test
- [ ] T082 [P] Create golden recording using real tasks.md execution

### Final Validation

- [ ] T083 Run `bun run lint` (biome) and fix any errors
- [ ] T084 Run `bun run typecheck` (tsc --noEmit) and fix any errors
- [ ] T085 Run `bun test` and ensure all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - Parser Agent
- **User Story 2 (Phase 4)**: Depends on User Story 1 - Harness uses Parser
- **User Story 3 (Phase 5)**: Depends on User Story 2 - Validation in Harness
- **User Story 4 (Phase 6)**: Depends on User Stories 1-3 - Wraps all agents
- **User Story 5 (Phase 7)**: Depends on User Story 4 - Records narratives too
- **Factory (Phase 8)**: Depends on all user stories
- **Documentation (Phase 9)**: Depends on Factory (needs stable API)
- **Polish (Phase 10)**: Depends on all implementation phases

### User Story Dependencies

- **User Story 1 (Parser Agent)**: Foundation only - No story dependencies
- **User Story 2 (Task Harness)**: Depends on US1 (needs parsed tasks)
- **User Story 3 (Review Validation)**: Depends on US2 (integrates into harness)
- **User Story 4 (Monologue)**: Depends on US1-3 (wraps all agents)
- **User Story 5 (Recording)**: Depends on US4 (records narratives)

### Within Each User Story

- Zod schemas before agent implementations
- Prompt templates before agent classes
- Core logic before integration
- JSDoc documentation alongside implementation
- Lint + typecheck at end of each phase

### Parallel Opportunities

- T002, T003, T004 can run in parallel (Setup)
- T008-T014, T017 can run in parallel (all Zod schemas + docs)
- T051-T054 can run in parallel (monologue wrappers for different agents)
- T072-T074 can run in parallel (Documentation files)
- T078-T079, T081-T082 can run in parallel (Polish)

---

## Parallel Example: Foundational Phase

```bash
# Launch all Zod schema tasks together:
Task: "Define Zod schemas for ParsedTask, TaskFlags, PhaseInfo in packages/sdk/src/harness/types.ts"
Task: "Define Zod schemas for TaskResult, ValidationResult, FailureRecord in packages/sdk/src/harness/types.ts"
Task: "Define Zod schemas for ParserAgentInput, ParserAgentOutput, ParserMetadata in packages/sdk/src/harness/types.ts"
Task: "Define Zod schemas for CodingAgentInput, CodingAgentOutput, CodingAction in packages/sdk/src/harness/types.ts"
Task: "Define Zod schemas for ReviewAgentInput, ReviewAgentOutput, ValidationCheck in packages/sdk/src/harness/types.ts"
Task: "Define Zod schemas for TaskHarnessConfig, TaskHarnessState, NarrativeEntry in packages/sdk/src/harness/types.ts"
Task: "Define Zod schema for AgentAbortSignal, RetryRecord in packages/sdk/src/harness/types.ts"
Task: "Add JSDoc documentation for all Zod schemas in packages/sdk/src/harness/types.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. Complete Phase 1: Setup + Validation
2. Complete Phase 2: Foundational + Validation (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Parser Agent) + Validation
4. Complete Phase 4: User Story 2 (Task Harness) + Validation
5. Complete Phase 5: User Story 3 (Review Validation) + Validation
6. **STOP and VALIDATE**: Test harness can parse tasks.md, execute tasks, validate completion

### Incremental Delivery

1. Setup + Foundational + US1 → Parser works standalone
2. Add US2 → Harness executes tasks
3. Add US3 → Tasks are validated, not just coded
4. Add US4 → Coherent narrative stream
5. Add US5 → Recording/replay for TDD
6. Add Documentation → API reference complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **Lint + typecheck at end of each phase** ensures code quality gates
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution check passed in plan.md - all new code must maintain strict TypeScript
- Run `/speckit.analyze` to validate cross-artifact consistency
