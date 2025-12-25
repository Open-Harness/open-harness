# Tasks: Testing Infrastructure Audit

**Input**: Design documents from `/specs/004-test-infra-audit/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md
**Tests**: No test tasks required - this is an audit and documentation feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Context Manifest

### Default Context Rules

> Applies to ALL tasks unless overridden in a specific phase

**Read from** (implementing agent SHOULD access):
- `specs/004-test-infra-audit/spec.md` - requirements and user stories
- `specs/004-test-infra-audit/plan.md` - implementation plan and structure
- `specs/004-test-infra-audit/research.md` - research decisions
- `specs/004-test-infra-audit/data-model.md` - entity definitions
- `specs/004-test-infra-audit/quickstart.md` - developer guide reference
- `packages/sdk/tests/` - existing test patterns and structure
- `packages/sdk/recordings/` - golden recording fixtures

**Do NOT read from** (prototype isolation):
- `node_modules/`, `dist/`, `build/` - generated/external files
- `apps/` - unrelated workspace packages
- `harnesses/` - harness implementations (not testing infra)
- `listr2/examples/` - external prototype code from prior feature
- Other feature specs (stay focused on current feature)

### Phase-Specific Overrides

**Phase 3 (User Story 1 - Safe Defaults)**:
- Additional read: `packages/sdk/package.json` - current test scripts
- Additional read: `packages/sdk/bunfig.toml` - bun configuration (if exists)

**Phase 4 (User Story 2 - Live Tests)**:
- Additional read: `packages/sdk/tests/integration/` - live test patterns
- Additional read: `packages/sdk/tests/helpers/recording-wrapper.ts` - recording behavior

**Phase 5 (User Story 3 - Documentation)**:
- Additional read: All test directories for comprehensive documentation
- Additional read: `packages/sdk/tests/helpers/` - helper patterns to document

**Phase 6 (User Story 4 - Audit)**:
- Read ALL test infrastructure for comprehensive audit
- Read `packages/sdk/src/` to map test coverage

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Primary package**: `packages/sdk/` (monorepo workspace)
- **Test directories**: `packages/sdk/tests/unit/`, `packages/sdk/tests/replay/`, `packages/sdk/tests/integration/`
- **Recordings**: `packages/sdk/recordings/golden/`
- **Documentation**: `packages/sdk/docs/`
- **Audit output**: `specs/004-test-infra-audit/audit.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify current state and prepare for changes

- [ ] T001 Verify existing test structure matches plan.md in packages/sdk/tests/
- [ ] T002 [P] Verify existing package.json test scripts in packages/sdk/package.json
- [ ] T003 [P] Review current recording infrastructure in packages/sdk/tests/helpers/recording-wrapper.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Confirm recording behavior is opt-in (verify startCapture() requirement) in packages/sdk/tests/helpers/recording-wrapper.ts
- [ ] T005 Document current test category structure in working notes for reference

**Checkpoint**: Foundation verified - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Run Safe Tests by Default (Priority: P1) 🎯 MVP

**Goal**: Default `bun test` runs only unit + replay tests (no live API calls, no recordings)

**Independent Test**: Run `bun test` and verify no network calls are made, no new files are created, and tests complete in <30 seconds.

**Requirements Covered**: FR-001, FR-002, FR-003, SC-001, SC-002, SC-003

### Implementation for User Story 1

- [ ] T006 [US1] Update package.json test script to run only tests/unit and tests/replay in packages/sdk/package.json
- [ ] T007 [P] [US1] Add test:unit script to run only tests/unit in packages/sdk/package.json
- [ ] T008 [P] [US1] Add test:replay script to run only tests/replay in packages/sdk/package.json
- [ ] T009 [US1] Verify default test suite passes without API credentials in packages/sdk/
- [ ] T010 [US1] Verify default test suite completes in under 30 seconds in packages/sdk/
- [ ] T011 [US1] Verify no new recording files are created during default test run in packages/sdk/recordings/

**Checkpoint**: At this point, User Story 1 should be fully functional - `bun test` is safe by default

---

## Phase 4: User Story 2 - Explicit Live Test Execution (Priority: P2)

**Goal**: Dedicated command for live integration tests with opt-in recording

**Independent Test**: Run `bun test:live` and verify API calls are made only with this specific command.

**Requirements Covered**: FR-004, FR-005, FR-006, FR-007, FR-008, FR-009

### Implementation for User Story 2

- [ ] T012 [US2] Add test:live script to run only tests/integration in packages/sdk/package.json
- [ ] T013 [US2] Add test:all script to run all test categories in packages/sdk/package.json
- [ ] T014 [US2] Remove misleading ANTHROPIC_API_KEY check from live-sdk.test.ts per research.md in packages/sdk/tests/integration/live-sdk.test.ts
- [ ] T015 [US2] Verify live tests do not auto-record (recording requires explicit startCapture) in packages/sdk/tests/integration/
- [ ] T016 [US2] Test that test:live command executes successfully with OAuth authentication in packages/sdk/

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Comprehensive Testing Documentation (Priority: P3)

**Goal**: Clear documentation explaining testing philosophy, structure, and extension patterns

**Independent Test**: A new developer can read the documentation and correctly add a new test following established patterns.

**Requirements Covered**: FR-010, FR-011, FR-012, FR-013, FR-014, SC-004

### Implementation for User Story 3

- [ ] T017 [US3] Create TESTING.md with testing philosophy section in packages/sdk/docs/TESTING.md
- [ ] T018 [US3] Add test category descriptions (unit, replay, integration) to TESTING.md in packages/sdk/docs/TESTING.md
- [ ] T019 [US3] Add step-by-step guide for adding unit tests to TESTING.md in packages/sdk/docs/TESTING.md
- [ ] T020 [US3] Add step-by-step guide for adding replay tests to TESTING.md in packages/sdk/docs/TESTING.md
- [ ] T021 [US3] Add step-by-step guide for adding integration tests to TESTING.md in packages/sdk/docs/TESTING.md
- [ ] T022 [US3] Add guide for capturing new fixtures to TESTING.md in packages/sdk/docs/TESTING.md
- [ ] T023 [US3] Add anti-patterns and common mistakes section to TESTING.md in packages/sdk/docs/TESTING.md
- [ ] T024 [US3] Add infrastructure extension guide to TESTING.md in packages/sdk/docs/TESTING.md
- [ ] T025 [US3] Add troubleshooting section with common errors to TESTING.md in packages/sdk/docs/TESTING.md

**Checkpoint**: Documentation complete - developers can follow guides to add any test type

---

## Phase 6: User Story 4 - Multi-Dimensional Audit Findings (Priority: P4)

**Goal**: Comprehensive audit identifying issues beyond known problems with severity and effort ratings

**Independent Test**: Review audit findings and verify each issue includes description, impact, and recommendation.

**Requirements Covered**: FR-015, FR-016, FR-017, FR-018, FR-019, SC-005, SC-006

### Implementation for User Story 4

- [ ] T026 [US4] Execute Dimension 1 audit: Test isolation and dependencies per research.md methodology in packages/sdk/tests/
- [ ] T027 [P] [US4] Execute Dimension 2 audit: Test performance and execution time per research.md methodology in packages/sdk/tests/
- [ ] T028 [P] [US4] Execute Dimension 3 audit: Test coverage and gaps per research.md methodology in packages/sdk/
- [ ] T029 [P] [US4] Execute Dimension 4 audit: Fixture management and staleness per research.md methodology in packages/sdk/recordings/
- [ ] T030 [P] [US4] Execute Dimension 5 audit: Parallelization and optimization opportunities per research.md methodology in packages/sdk/tests/
- [ ] T031 [US4] Compile audit findings with severity ratings (critical/high/medium/low) into audit.md in specs/004-test-infra-audit/audit.md
- [ ] T032 [US4] Add effort estimates (trivial/small/medium/large) to all findings in specs/004-test-infra-audit/audit.md
- [ ] T033 [US4] Create prioritized action plan in audit.md based on impact and effort in specs/004-test-infra-audit/audit.md
- [ ] T034 [US4] Verify at least 5 actionable findings beyond the 3 known issues per SC-005 in specs/004-test-infra-audit/audit.md

**Checkpoint**: Audit complete with at least 5 actionable findings beyond known issues

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T035 [P] Run final verification: default `bun test` completes in <30s without network
- [ ] T036 [P] Run final verification: all default tests pass without API credentials
- [ ] T037 [P] Run final verification: zero new recording files created during default test run
- [ ] T038 Cross-reference TESTING.md content with quickstart.md for consistency in specs/004-test-infra-audit/quickstart.md
- [ ] T039 Update CLAUDE.md if testing guidelines need to be reflected in project instructions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - verifies baseline
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in priority order (P1 → P2 → P3 → P4)
  - US3 (Documentation) and US4 (Audit) can run in parallel after US1/US2
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after US1 completion (scripts build on each other)
- **User Story 3 (P3)**: Can start after US2 completion (needs final command structure documented)
- **User Story 4 (P4)**: Can start after Foundational - Independent audit work

### Within Each User Story

- Script changes must be complete before verification tasks
- Documentation sections can be written in parallel where marked [P]
- Audit dimensions can be executed in parallel where marked [P]

### Parallel Opportunities

- Setup verification tasks T002 and T003 can run in parallel
- US1 script additions T007 and T008 can run in parallel
- US4 audit dimensions T027-T030 can run in parallel
- Final verification tasks T035-T037 can run in parallel

---

## Parallel Example: User Story 4 (Audit)

```bash
# Launch all audit dimensions together:
Task: "Execute Dimension 2 audit: Test performance"
Task: "Execute Dimension 3 audit: Test coverage"
Task: "Execute Dimension 4 audit: Fixture management"
Task: "Execute Dimension 5 audit: Parallelization"

# Note: Dimension 1 (isolation) runs first as baseline, then others in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: Foundational confirmation
3. Complete Phase 3: User Story 1 (safe defaults)
4. **STOP and VALIDATE**: Run `bun test` and verify safe behavior
5. Default test behavior is now safe - minimal viable improvement

### Incremental Delivery

1. Complete Setup + Foundational → Baseline verified
2. Add User Story 1 → Test safely by default → **MVP!**
3. Add User Story 2 → Live test command available → Full test separation
4. Add User Story 3 → Documentation complete → Self-documenting system
5. Add User Story 4 → Audit findings → Actionable improvement roadmap

### Critical Path

```
Setup → Foundational → US1 (Safe Defaults) → US2 (Live Command) → US3 (Docs)
                                                                    ↓
                                           ← ← ← ← ← ← US4 (Audit) ←
```

US4 can run in parallel with US3 after US2 completes.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and verifiable
- No test tasks included - this is an audit/documentation feature
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Key deliverables: package.json updates, TESTING.md, audit.md
