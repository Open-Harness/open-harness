# Implementation Plan: Testing Infrastructure Audit

**Branch**: `004-test-infra-audit` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-test-infra-audit/spec.md`

## Summary

Multi-dimensional audit of testing infrastructure to: (1) change recording defaults to opt-in, (2) separate live tests from fixture-based tests, (3) document testing philosophy and extension patterns, and (4) identify unknown issues beyond the known problems. Primary deliverables are configuration changes, documentation, and an audit report.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, bun:test
**Storage**: JSON fixture files in `recordings/golden/`, JSONL E2E recordings in `tests/fixtures/e2e/`
**Testing**: `bun test` with unit/, replay/, and integration/ directories
**Target Platform**: Node.js/Bun runtime (macOS/Linux development)
**Project Type**: Monorepo workspace (`packages/sdk/` is primary audit target)
**Performance Goals**: Default test suite (`bun test`) completes in <30 seconds without network
**Constraints**: Default tests must work offline, no API credentials required
**Scale/Scope**: ~15 test files, ~50 test cases, 8 golden recordings

### Current Testing Landscape

| Category | Directory | Current Behavior | Target Behavior |
|----------|-----------|------------------|-----------------|
| Unit | `tests/unit/` | No API calls, pure logic | No change needed |
| Replay | `tests/replay/` | Replays golden recordings | No change needed |
| Integration | `tests/integration/` | Makes live API calls, may record | NEEDS CLARIFICATION: Separate command? |
| Helpers | `tests/helpers/` | Recording/replay utilities | NEEDS CLARIFICATION: Recording opt-in? |

### Unknowns Requiring Research

1. **U001**: Current test scripts run ALL tests including integration - how to separate?
2. **U002**: `createRecordingContainer` behavior - does it auto-record or require explicit `startCapture()`?
3. **U003**: Best practices for test categorization in Bun ecosystem
4. **U004**: How to handle missing/corrupted fixture recovery

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Type Safety First

| Principle | Compliance | Notes |
|-----------|------------|-------|
| `strict: true` in tsconfig | ✅ COMPLIANT | Verified in packages/sdk/tsconfig.json |
| No `any` usage | ✅ COMPLIANT | Existing tests use proper typing |
| Explicit function signatures | ✅ COMPLIANT | Test helpers are well-typed |
| API boundaries have schemas | N/A | Audit feature has no new APIs |

### II. Verified by Reality

| Principle | Compliance | Notes |
|-----------|------------|-------|
| Unit tests for pure logic | ✅ COMPLIANT | `tests/unit/` tests parsers, transformers |
| Agent/SDK uses recorder pattern | ✅ COMPLIANT | `recording-wrapper.ts` captures LLM responses |
| Fixtures from actual LLM calls | ✅ COMPLIANT | `recordings/golden/` has real captures |
| Live integration test exists | ✅ COMPLIANT | `tests/integration/live-sdk.test.ts` |
| Golden recordings committed | ✅ COMPLIANT | In `recordings/golden/` |

### III. Dependency Injection Discipline

| Principle | Compliance | Notes |
|-----------|------------|-------|
| Services use `@injectable()` | ✅ COMPLIANT | Test helpers use Needle DI properly |
| Single composition root | ✅ COMPLIANT | `createContainer()` in container.ts |
| No circular dependencies | ✅ COMPLIANT | Token-based injection |
| Factory functions hide DI | ✅ COMPLIANT | `createRecordingContainer()`, `createReplayContainer()` |

**Pre-Research Gate Status**: ✅ PASS - All constitution principles satisfied

## Project Structure

### Documentation (this feature)

```text
specs/004-test-infra-audit/
├── plan.md              # This file
├── research.md          # Phase 0: Research findings
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Developer guide
├── contracts/           # Phase 1: API contracts (if any)
│   └── README.md        # No APIs for this feature - audit only
└── tasks.md             # Phase 2 output (/oharnes.tasks command)
```

### Source Code (repository root)

```text
packages/sdk/                           # Primary audit target
├── src/
│   └── core/
│       ├── recording-factory.ts        # Recording creation logic
│       └── replay-runner.ts            # Replay infrastructure
├── tests/
│   ├── fixtures/                       # Static test fixtures
│   │   ├── README.md                   # Fixture documentation
│   │   ├── e2e/                        # E2E capture data
│   │   └── sample-tasks.md             # Sample markdown fixtures
│   ├── helpers/                        # Test utilities
│   │   ├── recording-wrapper.ts        # Recording container factory
│   │   └── replay-runner.ts            # Replay container factory
│   ├── unit/                           # Pure logic tests (offline)
│   │   ├── agent-factory.test.ts
│   │   ├── backoff.test.ts
│   │   ├── container.test.ts
│   │   ├── dependency-resolver.test.ts
│   │   ├── event-mapper.test.ts
│   │   ├── harness.test.ts
│   │   ├── parser-agent.test.ts
│   │   └── workflow-builder.test.ts
│   ├── replay/                         # Recording-based tests (offline)
│   │   ├── agents.replay.test.ts
│   │   └── parser-agent.replay.test.ts
│   └── integration/                    # Live API tests (online)
│       └── live-sdk.test.ts
├── recordings/                         # Golden recordings
│   └── golden/
│       ├── coding-agent/
│       ├── parser-agent/
│       └── review-agent/
└── docs/
    └── TESTING.md                      # NEW: Testing philosophy docs
```

**Structure Decision**: Monorepo workspace structure with `packages/sdk/` as the primary audit target. No new directories needed - modifications focus on existing test infrastructure and adding documentation.

## Complexity Tracking

> No constitution violations identified - no complexity justification needed.

## Context Scope

### Include in Agent Context

> Directories and files the implementing agent SHOULD access

- `packages/sdk/src/` - SDK source code
- `packages/sdk/tests/` - existing test patterns and helpers
- `packages/sdk/recordings/` - golden recording fixtures
- `specs/004-test-infra-audit/` - this feature's specification and plan
- `.specify/memory/constitution.md` - project constitution for reference

### Exclude from Agent Context

> Directories and files the implementing agent should NOT access (prototype isolation)

- `node_modules/`, `dist/`, `build/` - generated/external files
- `apps/` - unrelated workspace packages
- `harnesses/` - harness implementations (not testing infra)
- `listr2/examples/` - external prototype code (from prior feature)

**Rationale**: This is an audit and documentation feature - context should focus narrowly on the testing infrastructure within packages/sdk/. The apps/ and harnesses/ directories are consumers of the SDK, not testing infrastructure.

## Verification Gates

### Pre-Commit Gates

> Must pass before ANY commit during implementation

- [ ] All tests pass: `bun test` (in packages/sdk/)
- [ ] Type checking passes: `bun run typecheck` (in packages/sdk/)
- [ ] Linting passes: `bun run lint` (in packages/sdk/)
- [ ] No console.log/debug statements in production code

### Task Completion Gates

> Verified after each task is marked complete

- [ ] Task file paths match actual created/modified files
- [ ] Task marked `[X]` in tasks.md
- [ ] New code follows patterns from plan.md Project Structure

### Feature Completion Gates

> Must pass before feature is considered complete

- [ ] All tasks marked `[X]` in tasks.md
- [ ] All critical file paths exist (see below)
- [ ] Default `bun test` completes in <30 seconds without network
- [ ] Default `bun test` passes without API credentials
- [ ] Zero new recording files created by default test run
- [ ] Documentation reviewed for completeness

### Critical File Paths

> These files MUST exist at feature completion (validates against tasks.md paths)

```text
packages/sdk/docs/TESTING.md           # Testing philosophy documentation
specs/004-test-infra-audit/audit.md    # Audit findings report
packages/sdk/package.json              # Updated with new test scripts
```

### Test Coverage Expectations

- **Minimum line coverage**: N/A (audit feature, no new code modules)
- **Required test types**: Verification that default tests work offline
- **Success Criteria**: SC-001 through SC-006 from spec.md must all pass
