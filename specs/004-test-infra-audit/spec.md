# Feature Specification: Testing Infrastructure Audit

**Feature Branch**: `004-test-infra-audit`
**Created**: 2025-12-26
**Status**: Draft
**Input**: Multi-dimensional audit of testing infrastructure - change recording defaults, separate live/fixture tests, document philosophy & patterns, identify unknown unknowns

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Safe Tests by Default (Priority: P1)

As a developer, I want to run `bun test` and have only fast, safe tests execute by default - no live API calls, no recording to disk - so that I can validate my code changes quickly without side effects or external dependencies.

**Why this priority**: This is the foundational behavioral change. Currently running tests may trigger live API calls and write recordings, which wastes API credits, creates unexpected file changes, and slows down the development loop. Safe defaults protect developers from accidental resource consumption.

**Independent Test**: Run the default test command and verify no network calls are made, no new files are created, and tests complete in under 30 seconds.

**Acceptance Scenarios**:

1. **Given** a clean working directory, **When** I run `bun test`, **Then** only unit tests and replay tests execute (no live API calls are made)
2. **Given** a clean working directory, **When** I run `bun test`, **Then** no new recording files are created on disk
3. **Given** I have no API key configured, **When** I run `bun test`, **Then** all tests pass (no authentication required)

---

### User Story 2 - Explicit Live Test Execution (Priority: P2)

As a developer, I want a dedicated command to run live integration tests when I explicitly choose to, so that I can verify real API behavior only when needed and remain in control of when recordings are captured.

**Why this priority**: Live tests are valuable for validating real API behavior but should be opt-in due to cost and side effects. Developers need clear separation between safe and live test modes.

**Independent Test**: Run the live test command and verify API calls are made only when this specific command is invoked.

**Acceptance Scenarios**:

1. **Given** valid API credentials, **When** I run the live test command, **Then** real API calls are executed
2. **Given** no recording flag is set, **When** I run live tests, **Then** no recordings are created (recordings require explicit opt-in)
3. **Given** I run live tests with the record flag, **When** tests complete, **Then** recordings are saved to the appropriate fixtures directory

---

### User Story 3 - Comprehensive Testing Documentation (Priority: P3)

As a developer (including AI agents), I want clear documentation explaining the testing philosophy, structure, and extension patterns, so that I can understand how to properly write and maintain tests in this codebase.

**Why this priority**: Documentation enables scalable team contributions and AI-assisted development. Without clear guidance, developers may introduce anti-patterns or duplicate existing functionality.

**Independent Test**: A new developer can read the documentation and correctly add a new test following established patterns without requiring additional guidance.

**Acceptance Scenarios**:

1. **Given** the testing documentation exists, **When** I read it, **Then** I understand the difference between unit, replay, and live test categories
2. **Given** the documentation exists, **When** I want to add a new test, **Then** I can find step-by-step guidance for each test type
3. **Given** the documentation exists, **When** I want to avoid common mistakes, **Then** I can find a list of anti-patterns and code smells to avoid

---

### User Story 4 - Multi-Dimensional Audit Findings (Priority: P4)

As a project maintainer, I want a comprehensive audit that identifies testing infrastructure issues beyond the known problems, so that I can address systemic improvements and prevent future technical debt.

**Why this priority**: Known problems may be symptoms of deeper issues. A thorough audit surfaces unknown unknowns - issues that haven't been noticed yet but affect test reliability, performance, or maintainability.

**Independent Test**: Review the audit findings and verify each identified issue includes a clear description, impact assessment, and recommended resolution.

**Acceptance Scenarios**:

1. **Given** the audit is complete, **When** I review findings, **Then** each issue is categorized by severity and impact
2. **Given** an issue is identified, **When** I read its description, **Then** I understand what's wrong and why it matters
3. **Given** the audit findings exist, **When** I prioritize improvements, **Then** I can make informed decisions based on impact and effort

---

### Edge Cases

- What happens when a developer runs tests in CI without API credentials? All default tests should pass.
- How does the system handle partial recordings (interrupted during capture)? Should not corrupt existing fixtures.
- What happens when replay fixtures are missing or corrupted? Clear error message with recovery guidance.
- How should tests behave in offline/air-gapped environments? Unit and replay tests should work fully offline.

## Requirements *(mandatory)*

### Functional Requirements

#### Default Behavior Changes
- **FR-001**: Test framework MUST run only unit and replay tests by default (no live tests)
- **FR-002**: Test framework MUST NOT create or modify recording files by default
- **FR-003**: Test framework MUST NOT require API credentials for default test execution

#### Live Test Separation
- **FR-004**: System MUST provide a separate command for running live integration tests
- **FR-005**: Live tests MUST be clearly distinguished from fixture-based tests (different command and/or directory)
- **FR-006**: Live tests MUST NOT record by default - recording MUST require an explicit flag

#### Recording Controls
- **FR-007**: Recording MUST only occur when explicitly requested via command-line flag or environment variable
- **FR-008**: Recordings MUST be saved in a predictable, organized directory structure
- **FR-009**: System MUST provide a way to regenerate/update existing recordings

#### Documentation
- **FR-010**: Documentation MUST explain the testing philosophy (why tests are structured this way)
- **FR-011**: Documentation MUST describe each test category and when to use it
- **FR-012**: Documentation MUST provide step-by-step guides for adding new tests of each type
- **FR-013**: Documentation MUST list anti-patterns and common mistakes to avoid
- **FR-014**: Documentation MUST explain how to extend the testing infrastructure

#### Audit Deliverables
- **FR-015**: Audit MUST examine test isolation and dependencies
- **FR-016**: Audit MUST evaluate test performance and execution time
- **FR-017**: Audit MUST assess test coverage and identify gaps
- **FR-018**: Audit MUST review fixture management and staleness
- **FR-019**: Audit MUST identify opportunities for parallelization or optimization

### Key Entities

- **Test Category**: Classification of tests (unit, replay, live) with distinct execution characteristics and requirements
- **Recording Session**: A captured API interaction that can be replayed for deterministic testing
- **Test Configuration**: Settings controlling test behavior (recording mode, API credentials, fixture paths)
- **Audit Finding**: An identified issue or improvement opportunity with severity, impact, and recommended action

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Default test suite (`bun test`) completes in under 30 seconds without network connectivity
- **SC-002**: 100% of default tests pass without any API credentials configured
- **SC-003**: Zero new recording files created when running default test suite
- **SC-004**: Documentation enables a new developer to add their first test of each type within 15 minutes
- **SC-005**: Audit surfaces at least 5 actionable findings beyond the 3 known issues (recording defaults, test separation, documentation)
- **SC-006**: All identified improvements have clear severity ratings and estimated effort levels

## Assumptions

- The codebase uses Bun as the test runner (`bun test`)
- Current test structure already has `unit/`, `replay/`, and `integration/` directories
- The `createRecordingContainer` helper exists and can be modified to support opt-in recording
- API recordings are JSON files stored in a fixtures directory
- The project constitution may need updates to reflect testing standards (out of scope for this feature but noted)
