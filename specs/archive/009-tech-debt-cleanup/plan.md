# Implementation Plan: Tech Debt Cleanup Sprint

**Branch**: `009-tech-debt-cleanup` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-tech-debt-cleanup/spec.md`

**Note**: This template is filled in by the `/oharnes.plan` command.

## Summary

Targeted tech debt cleanup to unblock development: convert live SDK tests to replay-based tests (FR-001-004), clean git history by removing errant commits and properly committing 008 work (FR-005-007), remove/mark deprecated exports (FR-008-010), and create deprecation documentation (FR-011-012).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, bun:test
**Storage**: JSON fixture files in `recordings/golden/`, test fixtures as embedded data
**Testing**: bun test (unit + replay), bun test:live (integration with real LLM)
**Target Platform**: Node.js / Bun runtime
**Project Type**: Single (monorepo package)
**Performance Goals**: Full test suite < 60 seconds without network
**Constraints**: No network calls in default test suite, no breaking API changes
**Scale/Scope**: ~8 deprecated exports, 4 errant commits, 21 uncommitted 008 files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Type Safety First
- **Status**: ✅ Compliant
- **Verification**: No new code being written; cleanup only removes deprecated exports
- **Note**: Any deprecated code removal maintains strict typing

### II. Verified by Reality
- **Status**: ✅ Compliant (key change)
- **Verification**: Converting `live-sdk.test.ts` from live LLM calls to replay-based tests
- **Note**: Golden recordings already exist in `recordings/golden/` from previous live captures
- **Action**: Tests will use recorder pattern - replay for TDD, live for verification

### III. Dependency Injection Discipline
- **Status**: ✅ Compliant
- **Verification**: No DI changes; deprecated exports are alias removals, not structural changes

### Tool Patterns: Bun CLI Dual Modes
- **Status**: ✅ Compliant
- **Verification**: Using `bun run test` for package.json configured test behavior
- **Note**: Spec explicitly requires `bun test` to work (FR-001), which the package.json "test" script already configures correctly

## Project Structure

### Documentation (this feature)

```text
specs/009-tech-debt-cleanup/
├── plan.md              # This file
├── research.md          # Phase 0 output - git rebase strategy, test migration approach
├── data-model.md        # Phase 1 output - deprecated exports inventory
├── quickstart.md        # Phase 1 output - cleanup execution guide
└── tasks.md             # Phase 2 output (/oharnes.tasks command)
```

### Source Code (repository root)

```text
packages/sdk/
├── src/
│   ├── callbacks/types.ts       # Deprecated: StreamCallbacks alias
│   ├── core/tokens.ts           # Deprecated: LiveSDKRunnerToken alias
│   ├── index.ts                 # Re-exports (deprecated items to remove)
│   ├── providers/anthropic/runner/
│   │   ├── anthropic-runner.ts  # Deprecated: LiveSDKRunner alias
│   │   └── base-agent.ts        # Deprecated: BaseAgent, StreamCallbacks
│   └── workflow/orchestrator.ts # Console.log statements to remove
├── tests/
│   ├── integration/
│   │   ├── live-sdk.test.ts     # TO CONVERT: Live LLM → replay-based
│   │   └── ...                  # Other integration tests (keep as live)
│   └── replay/
│       └── agents.replay.test.ts # Existing replay pattern to follow
└── recordings/golden/           # Golden recordings for replay
    ├── coding-agent/
    └── review-agent/

docs/
└── deprecation-schedule.md      # NEW: FR-011 output
```

**Structure Decision**: Single monorepo package (packages/sdk/). Cleanup modifies existing files, creates deprecation documentation, and converts one test file.

## Complexity Tracking

> **No violations - this is a cleanup sprint, not new feature development**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Context Scope

<!--
  PURPOSE: Prevents prototype contamination during implementation.
  This cleanup sprint needs access to deprecated code to understand and remove it.
-->

### Include in Agent Context

> Directories and files the implementing agent SHOULD access

- `packages/sdk/src/` - main source code (to find deprecated exports)
- `packages/sdk/tests/` - existing test patterns (to follow replay pattern)
- `specs/009-tech-debt-cleanup/` - this feature's specification and plan
- `recordings/golden/` - golden recordings for replay tests
- `.git/` - git history for rebase operations

### Exclude from Agent Context

> Directories and files the implementing agent should NOT access

- `node_modules/`, `dist/` - generated/external files
- `listr2/` - external dependency examples
- `specs/backlog/` - future planning (not implementation)

**Rationale**: Cleanup requires full visibility into current code state. No prototype isolation needed since we're removing code, not adding patterns.

## Verification Gates

### Pre-Commit Gates

> Must pass before ANY commit during implementation

- [ ] All tests pass: `bun run test` (unit + replay only)
- [ ] Type checking passes: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
- [ ] No console.log/debug statements in production code (FR-010)

### Task Completion Gates

> Verified after each task is marked complete

- [ ] Task file paths match actual created/modified files
- [ ] Task marked `[X]` in tasks.md
- [ ] Deprecated exports removed follow existing patterns

### Feature Completion Gates

> Must pass before feature is considered complete

- [ ] All tasks marked `[X]` in tasks.md
- [ ] Test suite completes in < 60 seconds without network (SC-001)
- [ ] Zero deprecated exports that are unused (SC-004: reduce by 50%)
- [ ] Deprecation document exists (SC-006)
- [ ] All commits on feature branch are related to cleanup (SC-003)

### Critical File Paths

> These files MUST exist at feature completion

```text
packages/sdk/tests/replay/live-sdk.replay.test.ts  # Converted from integration
docs/deprecation-schedule.md                        # FR-011 output
```

### Test Coverage Expectations

- **Minimum line coverage**: N/A (cleanup sprint, no new features)
- **Required test types**: Replay tests for converted live tests
- **Skip flag**: `--skip-tests` NOT applicable - tests must pass
