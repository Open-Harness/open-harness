# Tasks: Anthropic Package Architecture Refactor

**Input**: Design documents from `/specs/013-anthropic-refactor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests and replay tests per plan.md verification gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Context Manifest

### Default Context Rules

> Applies to ALL tasks unless overridden in a specific phase

**Read from** (implementing agent SHOULD access):
- `specs/013-anthropic-refactor/spec.md` - requirements and user stories
- `specs/013-anthropic-refactor/plan.md` - implementation plan and structure
- `specs/013-anthropic-refactor/data-model.md` - entity definitions
- `specs/013-anthropic-refactor/contracts/` - API contracts
- `specs/013-anthropic-refactor/research.md` - design decisions
- `packages/anthropic/src/` - existing source code to refactor
- `packages/sdk/src/` - core SDK types (IAgentRunner, IUnifiedEventBus)

**Do NOT read from** (prototype isolation):
- `specs/012-define-anthropic-agent/` - superseded spec (may cause confusion)
- `packages/anthropic/src/agents/*.prompt.md` - old markdown prompts being replaced
- `examples/` - prototype/example code
- `node_modules/`, `dist/`, `build/` - generated/external files
- `.knowledge/private/` - investor materials (not relevant)

### Phase-Specific Overrides

**Phase 2 (Foundational)**:
- Additional read: `packages/anthropic/src/agents/base-anthropic-agent.ts` - patterns to extract into InternalAnthropicAgent

**Phase 3 (User Story 1)**:
- Additional read: `packages/anthropic/src/runner/` - existing runner patterns
- Exclude: `packages/anthropic/src/runner/prompts.ts` - PromptRegistry being replaced

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Restructure package to three-layer architecture per FR-001

- [ ] T001 Create `packages/anthropic/src/infra/` directory structure with subdirectories `runner/`, `recording/`, `monologue/`
- [ ] T002 Create `packages/anthropic/src/provider/` directory
- [ ] T003 Create `packages/anthropic/src/presets/` directory with `prompts/` subdirectory
- [ ] T004 [P] Move `packages/anthropic/src/runner/*.ts` to `packages/anthropic/src/infra/runner/`
- [ ] T005 [P] Move `packages/anthropic/src/recording/*.ts` to `packages/anthropic/src/infra/recording/`
- [ ] T006 [P] Move `packages/anthropic/src/monologue/*.ts` to `packages/anthropic/src/infra/monologue/`
- [ ] T007 Update import paths in all moved files to reflect new locations
- [ ] T008 Verify `bun run typecheck` passes after moves

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Create `packages/anthropic/src/provider/types.ts` with `PromptTemplate<TData>`, `AnthropicAgentDefinition<TInput, TOutput>`, `ExecuteOptions`, `StreamOptions`, `AgentHandle` interfaces per contracts/factory-api.ts
- [ ] T010 Create `packages/anthropic/src/provider/prompt-template.ts` with `ExtractVars<S>` type and `createPromptTemplate()` factory per research.md Q2 decision
- [ ] T011 Create `packages/anthropic/src/provider/internal-agent.ts` with `InternalAnthropicAgent` class - extract core logic from `base-anthropic-agent.ts` using ONLY `IUnifiedEventBus` (remove dual event bus per research.md Q4)
- [ ] T012 Create `packages/anthropic/src/provider/factory.ts` with singleton global container pattern per research.md Q1 decision - implement `defineAnthropicAgent<TInput, TOutput>()` function
- [ ] T013 Create wrapper helpers `wrapWithRecording()` and `wrapWithMonologue()` in `packages/anthropic/src/provider/factory.ts` per research.md Q3 decision
- [ ] T014 Add `@deprecated` JSDoc tag to `IEventBus` and `IEventBusToken` in `packages/sdk/src/` with migration guide to `IUnifiedEventBus`
- [ ] T015 Create `packages/anthropic/src/provider/index.ts` barrel export for provider layer
- [ ] T016 Verify `bun run typecheck` passes with new provider layer

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Custom Agent Creation (Priority: P1) 🎯 MVP

**Goal**: Developer can define an agent with minimal boilerplate in less than 20 lines

**Independent Test**: Create TypeScript file, define prompt template with typed data, call `defineAnthropicAgent()` with schema, execute agent and receive typed output

### Unit Tests for User Story 1

- [ ] T017 [P] [US1] Create `packages/anthropic/tests/unit/prompt-template.test.ts` - test `createPromptTemplate()` type inference and render() function
- [ ] T018 [P] [US1] Create `packages/anthropic/tests/unit/factory.test.ts` - test `defineAnthropicAgent()` returns object with execute/stream methods

### Implementation for User Story 1

- [ ] T019 [US1] Implement `createPromptTemplate()` render logic with `{{variable}}` interpolation in `packages/anthropic/src/provider/prompt-template.ts`
- [ ] T020 [US1] Implement `createPromptTemplate()` validate logic using optional Zod schema in `packages/anthropic/src/provider/prompt-template.ts`
- [ ] T021 [US1] Implement `defineAnthropicAgent()` container initialization (lazy singleton pattern) in `packages/anthropic/src/provider/factory.ts`
- [ ] T022 [US1] Implement `defineAnthropicAgent()` input schema validation before execution in `packages/anthropic/src/provider/factory.ts`
- [ ] T023 [US1] Implement `defineAnthropicAgent()` execute() method that delegates to InternalAnthropicAgent.run() in `packages/anthropic/src/provider/factory.ts`
- [ ] T024 [US1] Implement `defineAnthropicAgent()` stream() method returning AgentHandle in `packages/anthropic/src/provider/factory.ts`
- [ ] T025 [US1] Add recording wrapper support in factory (wrapWithRecording) in `packages/anthropic/src/provider/factory.ts`
- [ ] T026 [US1] Add monologue wrapper support in factory (wrapWithMonologue) in `packages/anthropic/src/provider/factory.ts`
- [ ] T027 [US1] Update `packages/anthropic/src/index.ts` to export `defineAnthropicAgent`, `createPromptTemplate`, and types (remove class-based exports per FR-002)
- [ ] T028 [US1] Verify unit tests pass: `bun run test packages/anthropic/tests/unit/factory.test.ts`

**Checkpoint**: At this point, User Story 1 (custom agent creation) should be fully functional and testable independently

---

## Phase 4: User Story 2 - Quick Start with Presets (Priority: P1)

**Goal**: Developer can use pre-built CodingAgent with zero configuration (just import + execute)

**Independent Test**: Import `CodingAgent` from `@openharness/anthropic/presets`, call `.execute()` with task, observe typed output

### Implementation for User Story 2

- [ ] T029 [P] [US2] Create `packages/anthropic/src/presets/prompts/coding.ts` with TypeScript prompt template for coding tasks (replace markdown file)
- [ ] T030 [P] [US2] Create `packages/anthropic/src/presets/prompts/review.ts` with TypeScript prompt template for review tasks
- [ ] T031 [P] [US2] Create `packages/anthropic/src/presets/prompts/planner.ts` with TypeScript prompt template for planning tasks
- [ ] T032 [US2] Create `packages/anthropic/src/presets/coding-agent.ts` using `defineAnthropicAgent()` with CodingInputSchema and CodingOutputSchema
- [ ] T033 [US2] Create `packages/anthropic/src/presets/review-agent.ts` using `defineAnthropicAgent()` with ReviewInputSchema and ReviewOutputSchema
- [ ] T034 [US2] Create `packages/anthropic/src/presets/planner-agent.ts` using `defineAnthropicAgent()` with PlannerInputSchema and PlannerOutputSchema
- [ ] T035 [US2] Create `packages/anthropic/src/presets/index.ts` barrel export for all presets, schemas, and prompt templates
- [ ] T036 [US2] Update `packages/anthropic/package.json` exports field to add `"./presets"` subpath per FR-003
- [ ] T037 [US2] Create `packages/anthropic/tests/integration/presets.test.ts` - test CodingAgent import and basic execution
- [ ] T038 [US2] Verify preset tests pass: `bun run test packages/anthropic/tests/integration/presets.test.ts`

**Checkpoint**: At this point, User Story 2 (preset agents) should work with zero setup

---

## Phase 5: User Story 3 - Override Preset Prompts (Priority: P2)

**Goal**: Developer can customize preset prompts while keeping type safety

**Independent Test**: Import preset agent, define custom PromptTemplate matching input schema, pass via execute options, verify agent uses custom prompt

### Implementation for User Story 3

- [ ] T039 [US3] Add `prompt` override option to ExecuteOptions in `packages/anthropic/src/provider/types.ts` (already defined, verify it works)
- [ ] T040 [US3] Implement prompt override logic in `defineAnthropicAgent()` execute method - use options.prompt if provided, fallback to definition.prompt in `packages/anthropic/src/provider/factory.ts`
- [ ] T041 [US3] Add type safety test case in `packages/anthropic/tests/unit/factory.test.ts` - verify TypeScript error for incompatible template data
- [ ] T042 [US3] Update `packages/anthropic/tests/integration/presets.test.ts` - add test for custom prompt override with type safety

**Checkpoint**: At this point, preset prompts can be customized with type safety enforced

---

## Phase 6: User Story 4 - Portable Runtime (Priority: P2)

**Goal**: Package works in both Node.js and Bun environments

**Independent Test**: Run test suite with `node --test` and `bun test`, verify both pass

### Implementation for User Story 4

- [ ] T043 [US4] Remove all `Bun.file()` calls from `packages/anthropic/src/` - prompts are now TypeScript exports
- [ ] T044 [US4] Delete old markdown prompt files: `packages/anthropic/src/agents/*.prompt.md`
- [ ] T045 [US4] Verify no Bun-specific APIs remain in `packages/anthropic/src/` (grep for `Bun.`)
- [ ] T046 [US4] Add Node.js compatibility test in `packages/anthropic/tests/node-compat.test.ts` - verify import and basic usage
- [ ] T047 [US4] Verify both runtimes pass: `bun run test` AND manual test with `node --experimental-vm-modules`

**Checkpoint**: Package is runtime-agnostic (Node.js + Bun)

---

## Phase 7: User Story 5 - Documentation Navigation (Priority: P3)

**Goal**: Developer can navigate from root CLAUDE.md to architecture guide in 2 clicks or fewer

**Independent Test**: Open CLAUDE.md, follow link to canonical docs, find "How It Works" guide

### Implementation for User Story 5

- [ ] T048 [US5] Create `.knowledge/docs/how-it-works.md` with architecture layer diagram (infra → provider → presets), request flow, code examples per FR-012
- [ ] T049 [US5] Update root `CLAUDE.md` to add link to `.knowledge/docs/how-it-works.md` per FR-011
- [ ] T050 [US5] Ensure navigation CLAUDE.md → .knowledge/docs/ → how-it-works.md works in 2 clicks

**Checkpoint**: Documentation navigation meets SC-005 (2 clicks or fewer)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, backward compatibility, and final validation

- [ ] T051 [P] Delete old agent class files: `packages/anthropic/src/agents/` (after verifying presets work)
- [ ] T052 [P] Add backward compatibility warning in `packages/anthropic/src/index.ts` for deprecated exports (BaseAnthropicAgent, PromptRegistry)
- [ ] T053 [P] Update `packages/anthropic/package.json` exports for `./runner` and `./recording` to point to new `infra/` paths
- [ ] T054 Run full test suite: `bun run test` in packages/anthropic/
- [ ] T055 Run type checking: `bun run typecheck` in packages/anthropic/
- [ ] T056 Validate quickstart.md examples work: manually test each code snippet
- [ ] T057 Create doc sync script or CI step for FR-013 (copy .knowledge/docs/ to packages/sdk/docs/)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Phase 3 (needs defineAnthropicAgent)
- **User Story 3 (Phase 5)**: Depends on Phase 4 (needs preset agents)
- **User Story 4 (Phase 6)**: Can run in parallel with Phase 5 (different concerns)
- **User Story 5 (Phase 7)**: Independent of code - can run in parallel with Phase 5/6
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundation only - no other story dependencies
- **User Story 2 (P1)**: Requires US1 complete (needs factory)
- **User Story 3 (P2)**: Requires US2 complete (needs presets)
- **User Story 4 (P2)**: Independent - just removes Bun-specific code
- **User Story 5 (P3)**: Independent - documentation only

### Within Each User Story

- Unit tests → Core implementation → Integration tests
- Types → Implementation → Exports
- Commit after each logical group of tasks

### Parallel Opportunities

- Phase 1: T004, T005, T006 can run in parallel (moving files)
- Phase 3: T017, T018 can run in parallel (test files)
- Phase 4: T029, T030, T031 can run in parallel (prompt templates)
- Phase 8: T051, T052, T053 can run in parallel (cleanup tasks)

---

## Parallel Example: Phase 4 (User Story 2)

```bash
# Launch all prompt template tasks together:
Task: "Create coding.ts prompt template"
Task: "Create review.ts prompt template"
Task: "Create planner.ts prompt template"

# Then sequentially create agents that depend on templates:
Task: "Create coding-agent.ts"
Task: "Create review-agent.ts"
Task: "Create planner-agent.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (directory structure)
2. Complete Phase 2: Foundational (factory, types, internal agent)
3. Complete Phase 3: User Story 1 (defineAnthropicAgent works)
4. Complete Phase 4: User Story 2 (preset agents work)
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy/demo if ready - core framework is functional

### Incremental Delivery

1. Setup + Foundational → Factory API ready
2. Add User Story 1 → Custom agents work → Deploy (MVP!)
3. Add User Story 2 → Preset agents work → Deploy
4. Add User Story 3 → Prompt override works → Deploy
5. Add User Story 4 → Node.js compatible → Deploy
6. Add User Story 5 → Docs complete → Deploy
7. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
