# Feature Specification: Tech Debt Cleanup Sprint

**Feature Branch**: `009-tech-debt-cleanup`
**Created**: 2025-12-27
**Status**: Draft
**Input**: User description: "Targeted tech debt cleanup sprint: fix test infrastructure (replace live SDK tests with replay tests), clean git history (remove errant commits, properly commit 008 work), remove deprecated exports and dead code, add deprecation documentation"

## Background & Motivation

This feature addresses accumulated tech debt identified through comprehensive retrospective analysis of cycles 003-008. The codebase has grown through 5 feature cycles, each adding new patterns without fully deprecating old ones, resulting in:

- **Test Infrastructure Issues**: Live SDK tests (`tests/integration/live-sdk.test.ts`) call real LLMs and timeout, blocking CI/development
- **Git History Pollution**: 4 errant `add() function` commits on feature branches contaminate history; 008 feature work (~21 files) remains uncommitted
- **Deprecated Code Proliferation**: 8+ deprecated exports still in codebase (`BaseAgent`, `StreamCallbacks`, `LiveSDKRunner`, etc.)
- **Dead Code**: Unused exports, placeholder implementations, and backwards compatibility shims

This is a targeted cleanup sprint to unblock development, not a full architectural refactor.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Runs Tests Without Network (Priority: P1)

A developer wants to run the test suite quickly and reliably without making network calls. Currently, integration tests timeout waiting for LLM responses, blocking the development workflow.

**Why this priority**: Test reliability is foundational - all other development depends on a working test suite. Broken tests block CI, slow feedback loops, and reduce confidence in changes.

**Independent Test**: Can be fully tested by running `bun test` and verifying all tests complete in under 30 seconds with no network calls.

**Acceptance Scenarios**:

1. **Given** a developer has cloned the repository, **When** they run `bun test`, **Then** all tests pass within 30 seconds without requiring network connectivity
2. **Given** the test suite was previously using live LLM calls, **When** tests are converted to replay-based, **Then** test behavior remains identical (same assertions, same coverage)
3. **Given** recorded fixtures exist for agent interactions, **When** a developer runs replay tests, **Then** tests use fixtures instead of making live API calls

---

### User Story 2 - Developer Reviews Clean Git History (Priority: P2)

A developer reviewing the project history wants to understand what changes were made for each feature. Currently, feature branches contain unrelated commits (e.g., `add() function` variants) that obscure the actual work.

**Why this priority**: Clean history enables code review, debugging, and understanding project evolution. Polluted history wastes reviewer time and hides real changes.

**Independent Test**: Can be verified by running `git log --oneline` on the feature branch and confirming all commits relate to the feature's purpose.

**Acceptance Scenarios**:

1. **Given** the 008-unified-event-system work is uncommitted, **When** the cleanup is complete, **Then** all 008 feature files are properly committed with descriptive messages
2. **Given** errant commits exist on feature branches, **When** history is cleaned, **Then** unrelated commits are removed from feature branch history
3. **Given** a clean commit history exists, **When** a reviewer examines the branch, **Then** each commit clearly describes feature-related changes

---

### User Story 3 - Developer Uses Only Current APIs (Priority: P3)

A developer building new features wants to use the recommended APIs without confusion from deprecated alternatives. Currently, both old and new APIs are exported, creating uncertainty about which to use.

**Why this priority**: API clarity reduces onboarding time and prevents new code from using deprecated patterns. Cleanup now prevents further accumulation.

**Independent Test**: Can be verified by checking that deprecated exports are either removed or clearly marked with warnings.

**Acceptance Scenarios**:

1. **Given** deprecated exports like `BaseAgent` exist, **When** cleanup is complete, **Then** deprecated exports are removed if unused, or marked with console warnings if still needed
2. **Given** dead code exists (exported but never imported), **When** cleanup is complete, **Then** dead exports are removed from the codebase
3. **Given** a developer imports from the SDK, **When** they use autocomplete, **Then** they only see current recommended APIs (not deprecated alternatives)

---

### User Story 4 - Maintainer Understands Deprecation Timeline (Priority: P4)

A maintainer needs to know which APIs are deprecated and when they will be removed. Currently, deprecation status is scattered across JSDoc comments with no unified timeline.

**Why this priority**: Documentation prevents regression (re-using deprecated APIs) and helps plan future cleanup. Lower priority because it doesn't block immediate development.

**Independent Test**: Can be verified by checking for a deprecation document that lists all deprecated items with removal targets.

**Acceptance Scenarios**:

1. **Given** multiple deprecated exports exist, **When** documentation is complete, **Then** a single document lists all deprecated APIs with their replacements
2. **Given** deprecated APIs have removal targets, **When** a developer reads the documentation, **Then** they know which major version will remove each API

---

### Edge Cases

- What happens when deprecated code is still imported by external consumers? (Answer: Mark with warnings, defer removal to next major version)
- How does the system handle test fixtures that become stale? (Answer: Document fixture regeneration process)
- What if rebasing causes merge conflicts with remote changes? (Answer: Create clean branch from main, cherry-pick only valid work)

## Requirements *(mandatory)*

### Functional Requirements

**Test Infrastructure**

- **FR-001**: Test suite MUST complete without network connectivity
- **FR-002**: Tests that previously called live LLMs MUST use recorded fixtures (replay tests)
- **FR-003**: Test execution time MUST be under 60 seconds for the full suite (unit + replay)
- **FR-004**: Test fixtures MUST be stored in a documented location with clear naming conventions

**Git History**

- **FR-005**: Feature branch history MUST only contain commits related to the feature's purpose
- **FR-006**: Uncommitted feature work (008 files) MUST be properly staged and committed
- **FR-007**: Commit messages MUST follow conventional commit format and describe actual changes

**Deprecated Code Removal**

- **FR-008**: Exports marked `@deprecated` that are not imported anywhere MUST be removed
- **FR-009**: Exports marked `@deprecated` that ARE still used internally MUST emit console warnings when used
- **FR-010**: `console.log` statements in production code MUST be removed or replaced with proper logging

**Documentation**

- **FR-011**: A deprecation schedule document MUST list all deprecated APIs with their replacements
- **FR-012**: Test fixture regeneration process MUST be documented

### Key Entities

- **Deprecated Export**: An exported symbol marked with `@deprecated` JSDoc that should be phased out
- **Dead Code**: Exported symbols that are never imported by any other file in the codebase
- **Test Fixture**: Recorded LLM response data used to replay tests without network calls
- **Errant Commit**: A git commit on a feature branch that is unrelated to the feature's purpose

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Full test suite (`bun test`) completes in under 60 seconds with no network calls required
- **SC-002**: Zero test failures related to LLM timeouts or network unavailability
- **SC-003**: 100% of commits on feature branches relate to their stated feature purpose
- **SC-004**: Reduce deprecated exports by at least 50% (from current 8+ to 4 or fewer)
- **SC-005**: Zero `console.log` or `console.error` statements in production source files (excluding error handlers)
- **SC-006**: Deprecation document exists and lists all remaining deprecated APIs with replacement guidance

## Assumptions

- The existing replay test infrastructure (`tests/replay/`) is functional and can be extended
- Recorded fixtures for `CodingAgent` and `ReviewAgent` already exist in `recordings/golden/`
- The 008 feature work is complete and only needs to be committed (not implemented)
- Interactive git rebase is available and the developer can handle any conflicts manually
- External consumers of deprecated APIs do not exist (internal SDK only)

## Out of Scope

- Consolidating the 3 parallel event systems (EventBus, UnifiedEventBus, HarnessEvents) - this is architectural work for a future cycle
- Unifying the 4 factory patterns - defer to 010-event-unification or similar
- Full architectural refactor - this sprint focuses on targeted cleanup only
- Adding new features or capabilities
- Breaking changes to public API signatures
