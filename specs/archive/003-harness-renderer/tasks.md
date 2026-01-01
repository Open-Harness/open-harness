# Tasks: Harness Renderer Integration

**Input**: Design documents from `/specs/003-harness-renderer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Tests are NOT included (not explicitly requested in spec).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Package root**: `packages/sdk/src/`
- **Tests**: `packages/sdk/tests/`
- **Docs**: `packages/sdk/docs/`

---

## Phase 1: Setup (Provider Namespace Restructure)

**Purpose**: Restructure existing code to provider namespaces pattern before adding new features.

- [ ] T001 Create `packages/sdk/src/providers/anthropic/` directory structure
- [ ] T002 Move `packages/sdk/src/agents/` to `packages/sdk/src/providers/anthropic/agents/`
- [ ] T003 Move `packages/sdk/src/runner/` to `packages/sdk/src/providers/anthropic/runner/`
- [ ] T004 Update all imports across codebase to use new provider paths
- [ ] T005 Create barrel export in `packages/sdk/src/providers/anthropic/index.ts`
- [ ] T006 Remove orphaned `withMonologue` export from `packages/sdk/src/index.ts`
- [ ] T007 Run `bun test` to verify no regressions from restructure

**Checkpoint**: Provider namespace structure in place, all existing tests pass

---

## Phase 2: Foundational (Event Protocol & Interfaces)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**Critical**: No user story work can begin until this phase is complete

- [ ] T008 [P] Create `packages/sdk/src/renderer/protocol.ts` with HarnessEvent discriminated union types from contracts/event-protocol.ts
- [ ] T009 [P] Create `packages/sdk/src/renderer/interface.ts` with IHarnessRenderer interface and RendererConfig from contracts/renderer-interface.ts
- [ ] T010 [P] Create `packages/sdk/src/renderer/base-renderer.ts` with BaseHarnessRenderer abstract class (state tracking, event routing)
- [ ] T011 [P] Create `packages/sdk/src/providers/anthropic/monologue/types.ts` with MonologueConfig and MonologueMetadata types from contracts/monologue-config.ts
- [ ] T012 [P] Create `packages/sdk/src/providers/anthropic/monologue/prompts.ts` with DEFAULT, TERSE, and VERBOSE prompt constants
- [ ] T013 Add IMonologueGeneratorToken to `packages/sdk/src/core/tokens.ts`
- [ ] T014 Create barrel export in `packages/sdk/src/renderer/index.ts` (export protocol, interface, base-renderer)
- [ ] T015 Create barrel export in `packages/sdk/src/providers/anthropic/monologue/index.ts`

**Checkpoint**: Foundation ready - event protocol and interfaces defined, user story implementation can now begin

---

## Phase 3: User Story 1 - Real-time Narrative Streaming (Priority: P1) MVP

**Goal**: Transform opaque agent internals into readable progress updates that stream to terminal in real-time

**Independent Test**: Run a single task with monologue enabled and verify narrative text appears in SimpleConsoleRenderer output

### Implementation for User Story 1

- [ ] T016 [P] [US1] Create `packages/sdk/src/providers/anthropic/monologue/generator.ts` implementing AnthropicMonologueGenerator service
- [ ] T017 [P] [US1] Create `packages/sdk/src/renderer/simple.ts` implementing SimpleConsoleRenderer with ANSI colors
- [ ] T018 [US1] Create `packages/sdk/src/providers/anthropic/monologue/decorator.ts` implementing @AnthropicMonologue decorator (depends on T016)
- [ ] T019 [US1] Register AnthropicMonologueGenerator in DI container at `packages/sdk/src/core/container.ts`
- [ ] T020 [US1] Add `renderer?: IHarnessRenderer` to TaskHarnessConfig in `packages/sdk/src/harness/task-harness-types.ts`
- [ ] T021 [US1] Update `packages/sdk/src/harness/task-harness.ts` to emit HarnessEvents to renderer during execution
- [ ] T022 [US1] Implement onMonologue callback → task:narrative event translation in TaskHarness
- [ ] T023 [US1] Add renderer initialization in TaskHarness.run() lifecycle
- [ ] T024 [US1] Add renderer finalization in TaskHarness.run() lifecycle
- [ ] T025 [US1] Update `packages/sdk/src/providers/anthropic/monologue/index.ts` to export generator and decorator
- [ ] T026 [US1] Update `packages/sdk/src/renderer/index.ts` to export SimpleConsoleRenderer

**Checkpoint**: User Story 1 complete - narratives stream to terminal during task execution

---

## Phase 4: User Story 2 - Narrative History Context (Priority: P2)

**Goal**: Ensure narratives maintain context between updates forming a coherent story

**Independent Test**: Execute a multi-step task and verify subsequent narratives reference prior context without repetition

### Implementation for User Story 2

- [ ] T027 [US2] Add history tracking to AnthropicMonologueGenerator in `packages/sdk/src/providers/anthropic/monologue/generator.ts`
- [ ] T028 [US2] Implement history injection into system prompt for context continuity in generator
- [ ] T029 [US2] Add historySize configuration handling in @AnthropicMonologue decorator
- [ ] T030 [US2] Add MonologueMetadata (eventCount, historyLength) to narrative events in TaskHarness

**Checkpoint**: User Story 2 complete - narratives form coherent story with context continuity

---

## Phase 5: User Story 3 - Configurable Narrative Verbosity (Priority: P2)

**Goal**: Allow users to control narrative frequency via buffer configuration

**Independent Test**: Run same task with different buffer sizes and observe different narrative frequencies

### Implementation for User Story 3

- [ ] T031 [US3] Implement minBufferSize threshold handling in AnthropicMonologueGenerator
- [ ] T032 [US3] Implement maxBufferSize forced-flush handling in AnthropicMonologueGenerator
- [ ] T033 [US3] Implement "wait" signal (empty response) handling - continue buffering without rendering
- [ ] T034 [US3] Implement final flush of buffered events when task execution completes
- [ ] T035 [US3] Add buffer configuration validation (minBufferSize >= 1, maxBufferSize >= minBufferSize)

**Checkpoint**: User Story 3 complete - users can control narrative frequency

---

## Phase 6: User Story 4 - Multiple Renderer Support (Priority: P3)

**Goal**: Enable switching between simple console and rich listr2 renderers

**Independent Test**: Run same task with different renderer selections and observe appropriate output format

### Implementation for User Story 4

- [ ] T036 [P] [US4] Create `packages/sdk/src/renderer/listr2.ts` implementing Listr2HarnessRenderer with peer dependency check
- [ ] T037 [US4] Add subpath export `./renderer` in `packages/sdk/package.json` pointing to `./dist/renderer/index.js`
- [ ] T038 [US4] Add subpath export `./renderer/listr2` in `packages/sdk/package.json` pointing to `./dist/renderer/listr2.js`
- [ ] T039 [US4] Add subpath export `./anthropic` in `packages/sdk/package.json` pointing to `./dist/providers/anthropic/index.js`
- [ ] T040 [US4] Add listr2 as optional peer dependency in `packages/sdk/package.json`
- [ ] T041 [US4] Update main `packages/sdk/src/index.ts` to re-export default provider (Anthropic) for convenience imports

**Checkpoint**: User Story 4 complete - users can choose renderer implementation

---

## Phase 7: User Story 5 - Replay Mode Visualization (Priority: P3)

**Goal**: Enable recorded session playback with appropriate timing

**Independent Test**: Record a session and replay it, verify narratives appear with original execution timing

### Implementation for User Story 5

- [ ] T042 [US5] Add replay mode detection and replaySpeed handling to BaseHarnessRenderer
- [ ] T043 [US5] Implement timing delay calculations for replay mode in base-renderer
- [ ] T044 [US5] Add visual replay indicator support to SimpleConsoleRenderer
- [ ] T045 [US5] Add visual replay indicator support to Listr2HarnessRenderer
- [ ] T046 [US5] Add instant replay mode (replaySpeed = 0) handling

**Checkpoint**: User Story 5 complete - recorded sessions can be replayed with timing

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and verification

- [ ] T047 [P] Create `packages/sdk/docs/architecture.md` documenting system design, layer boundaries, provider namespaces
- [ ] T048 [P] Create `packages/sdk/docs/renderer-guide.md` documenting renderer usage and extension
- [ ] T049 Update `packages/sdk/README.md` with renderer examples and import patterns
- [ ] T050 [P] Add TSDoc comments to all public APIs in renderer module
- [ ] T051 [P] Add TSDoc comments to all public APIs in monologue module
- [ ] T052 Verify all subpath imports work correctly (`./anthropic`, `./renderer`, `./renderer/listr2`)
- [ ] T053 Run `bun build` and verify type checking passes
- [ ] T054 Run `bun test` full test suite
- [ ] T055 Verify tree-shaking works (unused providers not bundled)
- [ ] T056 Run quickstart.md validation - execute example code snippets

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (P1 - MVP)
- **User Story 2 (Phase 4)**: Depends on User Story 1 (builds on generator)
- **User Story 3 (Phase 5)**: Depends on User Story 1 (builds on generator)
- **User Story 4 (Phase 6)**: Depends on User Story 1 (needs SimpleConsoleRenderer as reference)
- **User Story 5 (Phase 7)**: Depends on User Story 4 (needs both renderers)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

```text
Phase 1 (Setup) ──► Phase 2 (Foundational)
                           │
                           ▼
                    Phase 3 (US1 - MVP)
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       Phase 4 (US2)  Phase 5 (US3)  Phase 6 (US4)
                                        │
                                        ▼
                                 Phase 7 (US5)
                                        │
                                        ▼
                                 Phase 8 (Polish)
```

### Within Each User Story

- Types/interfaces before implementations
- Generator before decorator
- Core implementation before harness integration
- Module exports after implementation complete

### Parallel Opportunities

**Phase 1 (Setup)**: Sequential - file moves have dependencies

**Phase 2 (Foundational)**: T008-T012 can run in parallel (different files)

**Phase 3 (US1)**:
- T016, T017 can run in parallel (generator and simple renderer)
- T018-T024 sequential (depend on generator)
- T025-T026 can run in parallel (exports)

**Phase 4-5 (US2, US3)**: Can potentially run in parallel with each other (both modify generator but different aspects)

**Phase 6 (US4)**: T036 can run before T037-T041

**Phase 8 (Polish)**: T047, T048, T050, T051 can run in parallel

---

## Parallel Example: Phase 2 Foundation

```bash
# Launch all foundational tasks together:
Task: "Create protocol.ts with HarnessEvent types"       # T008
Task: "Create interface.ts with IHarnessRenderer"        # T009
Task: "Create base-renderer.ts with state tracking"      # T010
Task: "Create monologue/types.ts with config types"      # T011
Task: "Create monologue/prompts.ts with preset prompts"  # T012
```

---

## Parallel Example: User Story 1 Core

```bash
# Launch generator and renderer in parallel:
Task: "Create AnthropicMonologueGenerator in generator.ts"  # T016
Task: "Create SimpleConsoleRenderer in simple.ts"            # T017
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (restructure to provider namespaces)
2. Complete Phase 2: Foundational (event protocol, interfaces)
3. Complete Phase 3: User Story 1 (real-time narrative streaming)
4. **STOP and VALIDATE**: Test narrative streaming with SimpleConsoleRenderer
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **MVP delivered!**
3. Add User Story 2 → Narratives have context continuity
4. Add User Story 3 → Users can configure verbosity
5. Add User Story 4 → Multiple renderer options
6. Add User Story 5 → Replay mode support
7. Polish → Documentation and verification complete

### Files Created/Modified Summary

**New Files (19)**:
- `src/renderer/protocol.ts`
- `src/renderer/interface.ts`
- `src/renderer/base-renderer.ts`
- `src/renderer/simple.ts`
- `src/renderer/listr2.ts`
- `src/renderer/index.ts`
- `src/providers/anthropic/monologue/types.ts`
- `src/providers/anthropic/monologue/prompts.ts`
- `src/providers/anthropic/monologue/generator.ts`
- `src/providers/anthropic/monologue/decorator.ts`
- `src/providers/anthropic/monologue/index.ts`
- `src/providers/anthropic/index.ts`
- `src/providers/openai/index.ts` (placeholder)
- `docs/architecture.md`
- `docs/renderer-guide.md`

**Modified Files (5)**:
- `src/index.ts` (re-exports, remove orphaned export)
- `src/core/tokens.ts` (add monologue token)
- `src/core/container.ts` (register generator)
- `src/harness/task-harness-types.ts` (add renderer config)
- `src/harness/task-harness.ts` (emit events to renderer)
- `package.json` (subpath exports, peer deps)

**Moved Files (2 directories)**:
- `src/agents/` → `src/providers/anthropic/agents/`
- `src/runner/` → `src/providers/anthropic/runner/`

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Performance targets: Narrative generation <200ms, rendering <16ms frame budget
- Zero breaking changes for existing SDK users (renderer is optional)
