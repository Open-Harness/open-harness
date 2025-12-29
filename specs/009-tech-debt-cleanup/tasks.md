# Tasks: Tech Debt Cleanup Sprint

**Input**: Design documents from `/specs/009-tech-debt-cleanup/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: No new test tasks required - this is a cleanup sprint. Existing tests must pass.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Context Manifest

### Default Context Rules

> Applies to ALL tasks unless overridden in a specific phase

**Read from** (implementing agent SHOULD access):
- `specs/009-tech-debt-cleanup/spec.md` - requirements and user stories
- `specs/009-tech-debt-cleanup/plan.md` - implementation plan and structure
- `specs/009-tech-debt-cleanup/data-model.md` - deprecated exports inventory
- `specs/009-tech-debt-cleanup/quickstart.md` - execution guide
- `packages/sdk/src/` - existing source code
- `packages/sdk/tests/` - existing test patterns
- `recordings/golden/` - golden recordings for replay tests

**Do NOT read from** (prototype isolation):
- `node_modules/`, `dist/` - generated/external files
- `listr2/` - external dependency examples
- `specs/backlog/` - future planning (not implementation)

### Phase-Specific Overrides

**Phase 3 (US1 - Test Infrastructure)**:
- Additional read: `packages/sdk/tests/replay/agents.replay.test.ts` - existing replay pattern to follow
- Additional read: `packages/sdk/tests/helpers/` - test helper patterns

**Phase 5 (US3 - Deprecated Code)**:
- Additional read: `packages/sdk/src/index.ts` - exports to modify
- Additional read: All files listed in data-model.md deprecated exports inventory

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `packages/sdk/` monorepo package
- Tests in `packages/sdk/tests/`
- Source in `packages/sdk/src/`
- Recordings in `recordings/golden/`
- Documentation in `docs/`

---

## Phase 1: Setup

**Purpose**: Verify baseline state and create backup

- [ ] T001 Verify baseline test state by running `bun run test` and `bun run typecheck` in packages/sdk/
- [ ] T002 [P] Record baseline metrics: test duration, console statement count, deprecated export count
- [ ] T003 [P] Create git backup branch `009-backup-YYYYMMDD` before any destructive operations

---

## Phase 2: Foundational (Verification Infrastructure)

**Purpose**: Ensure all verification tools work before making changes

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Verify golden recordings exist at recordings/golden/coding-agent/add-two-numbers.json
- [ ] T005 [P] Verify golden recordings exist at recordings/golden/review-agent/review-add-function.json
- [ ] T006 [P] Verify replay test helper exists at packages/sdk/tests/helpers/replay-runner.js
- [ ] T007 Document errant commits to remove by running `git log --oneline --all --grep="add function" -i`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Developer Runs Tests Without Network (Priority: P1)

**Goal**: Convert `live-sdk.test.ts` from live LLM calls to replay-based tests using existing fixtures

**Independent Test**: Run `bun test` and verify all tests complete in under 30 seconds with no network calls

**SC-001**: Full test suite < 60 seconds | **SC-002**: Zero network-related failures | **FR-001-004**

### Implementation for User Story 1

- [ ] T008 [US1] Create replay test file at packages/sdk/tests/replay/live-sdk.replay.test.ts following pattern from agents.replay.test.ts
- [ ] T009 [US1] Implement CodingAgent replay test using createReplayContainer("golden/coding-agent", "add-two-numbers") in packages/sdk/tests/replay/live-sdk.replay.test.ts
- [ ] T010 [US1] Implement ReviewAgent replay test using createReplayContainer("golden/review-agent", "review-add-function") in packages/sdk/tests/replay/live-sdk.replay.test.ts
- [ ] T011 [US1] Delete original live test file packages/sdk/tests/integration/live-sdk.test.ts
- [ ] T012 [US1] Verify test suite completes in < 60 seconds by running `time bun run test` in packages/sdk/

**Checkpoint**: User Story 1 complete - tests run without network, under 60 seconds

---

## Phase 4: User Story 2 - Developer Reviews Clean Git History (Priority: P2)

**Goal**: Remove errant commits and properly commit any uncommitted 008 work

**Independent Test**: Run `git log --oneline -20` and verify all commits relate to feature purpose

**SC-003**: 100% commit relevance | **FR-005-007**

### Implementation for User Story 2

- [ ] T013 [US2] Stage and commit any uncommitted 008 documentation files (.claude/commands/code-review.md, AGENTS.md, specs/ready/transport-architecture.md)
- [ ] T014 [US2] Document cleanup decision: cherry-pick clean branch OR squash-on-merge strategy per research.md R2
- [ ] T015 [US2] Verify git log shows only cleanup-related commits on current branch

**Checkpoint**: User Story 2 complete - git history is clean and documented

---

## Phase 5: User Story 3 - Developer Uses Only Current APIs (Priority: P3)

**Goal**: Remove unused deprecated exports and mark remaining with warnings; remove console statements

**Independent Test**: Run typecheck and verify deprecated exports reduced; grep for console statements

**SC-004**: Reduce deprecated exports by 50% | **SC-005**: Zero console.log in production | **FR-008-010**

### Remove Unused Deprecated Exports

- [ ] T016 [P] [US3] Remove LiveSDKRunner alias from packages/sdk/src/providers/anthropic/runner/anthropic-runner.ts (line ~44)
- [ ] T017 [P] [US3] Remove StreamCallbacks re-export from packages/sdk/src/index.ts (line ~300-302)
- [ ] T018 [US3] Run typecheck after removing exports to verify no external usages in packages/sdk/

### Mark Remaining Deprecated Exports with Warnings

- [ ] T019 [P] [US3] Add console.warn deprecation notice to BaseAgent constructor in packages/sdk/src/providers/anthropic/runner/base-agent.ts (suppress in test env)
- [ ] T020 [P] [US3] Enhance JSDoc deprecation notice for IAgentRunnerToken in packages/sdk/src/core/tokens.ts with migration guide link

### Remove Console Statements (FR-010)

- [ ] T021 [P] [US3] Remove all console.log/warn/error statements from packages/sdk/src/workflow/orchestrator.ts (lines 42, 46, 52, 55, 60, 66, 72, 74)
- [ ] T022 [P] [US3] Remove console.error from packages/sdk/src/factory/workflow-builder.ts (line ~125)
- [ ] T023 [P] [US3] Remove console.error from packages/sdk/src/monologue/anthropic-llm.ts (line ~63)
- [ ] T024 [P] [US3] Remove console.error from packages/sdk/src/core/unified-event-bus.ts (line ~189)
- [ ] T025 [P] [US3] Remove console.error from packages/sdk/src/harness/harness-instance.ts (line ~186)
- [ ] T026 [P] [US3] Replace console.warn with throw in packages/sdk/src/core/replay-runner.ts (line ~70)
- [ ] T027 [P] [US3] Remove console.error from packages/sdk/src/factory/wrap-agent.ts (line ~98)
- [ ] T028 [US3] Verify console statement removal by running grep -r "console\\." packages/sdk/src/ excluding renderers and CompositeRenderer

**Checkpoint**: User Story 3 complete - deprecated exports reduced, console statements removed

---

## Phase 6: User Story 4 - Maintainer Understands Deprecation Timeline (Priority: P4)

**Goal**: Create deprecation schedule document listing all deprecated APIs with replacements and removal targets

**Independent Test**: Verify docs/deprecation-schedule.md exists and lists all remaining deprecated APIs

**SC-006**: Deprecation document exists | **FR-011-012**

### Implementation for User Story 4

- [ ] T029 [US4] Create docs/ directory if not exists
- [ ] T030 [US4] Create docs/deprecation-schedule.md with currently deprecated APIs table (BaseAgent, StreamCallbacks, IAgentRunnerToken)
- [ ] T031 [US4] Add migration guide section to docs/deprecation-schedule.md for each deprecated API
- [ ] T032 [US4] Add test fixture regeneration documentation to docs/deprecation-schedule.md per FR-012
- [ ] T033 [US4] Verify deprecation document exists and is complete

**Checkpoint**: User Story 4 complete - deprecation documentation exists

---

## Phase 7: Polish & Final Verification

**Purpose**: Cross-cutting verification and final cleanup

- [ ] T034 Run full test suite: `bun run test` in packages/sdk/ (must pass)
- [ ] T035 [P] Run type checking: `bun run typecheck` in packages/sdk/ (must pass)
- [ ] T036 [P] Run linting: `bun run lint` in packages/sdk/ (must pass)
- [ ] T037 Verify all success criteria:
  - SC-001: Test suite < 60 seconds
  - SC-002: Zero network failures
  - SC-003: All commits relate to cleanup
  - SC-004: Deprecated exports reduced by 50%
  - SC-005: Zero console.log in production (except renderers)
  - SC-006: docs/deprecation-schedule.md exists
- [ ] T038 Run quickstart.md final verification checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Foundational phase completion - can run parallel to US1
- **User Story 3 (Phase 5)**: Depends on Foundational phase completion - can run parallel to US1/US2
- **User Story 4 (Phase 6)**: Depends on US3 completion (needs final deprecated list)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Phase 2 - Independent of other stories
- **User Story 3 (P3)**: Can start after Phase 2 - Independent of US1/US2
- **User Story 4 (P4)**: Should start after US3 to document final deprecated API state

### Within Each User Story

- Tasks marked [P] within same story can run in parallel
- Tasks without [P] depend on previous tasks in that story
- Commit after each logical group of tasks

### Parallel Opportunities

**After Phase 2 completes, these can run simultaneously:**

```
User Story 1 (Test Infrastructure)  ─┐
User Story 2 (Git History)          ─┼─► User Story 4 (Documentation) ─► Polish
User Story 3 (Deprecated Code)      ─┘
```

**Within Phase 5 (US3), these can run in parallel:**
- T016, T017 (remove exports)
- T019, T020 (add warnings)
- T021-T027 (remove console statements)

---

## Parallel Example: User Story 3

```bash
# Launch all console.log removal tasks together (all different files):
Task: T021 "Remove console statements from orchestrator.ts"
Task: T022 "Remove console.error from workflow-builder.ts"
Task: T023 "Remove console.error from anthropic-llm.ts"
Task: T024 "Remove console.error from unified-event-bus.ts"
Task: T025 "Remove console.error from harness-instance.ts"
Task: T026 "Replace console.warn in replay-runner.ts"
Task: T027 "Remove console.error from wrap-agent.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Test Infrastructure)
4. **STOP and VALIDATE**: Verify tests run without network in < 60 seconds
5. This alone unblocks CI/development workflow

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → CI unblocked (MVP!)
3. Add User Story 2 → Git history clean → Code review improved
4. Add User Story 3 → APIs clarified → Developer experience improved
5. Add User Story 4 → Documentation complete → Maintenance simplified

### Full Sprint (All Stories)

1. Complete Setup + Foundational together
2. Run US1, US2, US3 in parallel (or sequentially if single implementer)
3. Run US4 after US3 completes
4. Run Polish phase
5. All success criteria verified

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- This is a cleanup sprint - no new features, just removing/fixing existing code
- Keep console statements in CompositeRenderer (error isolation pattern per research.md R3)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
