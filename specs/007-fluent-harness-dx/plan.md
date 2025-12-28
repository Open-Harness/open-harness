# Implementation Plan: Fluent Harness DX

**Branch**: `007-fluent-harness-dx` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-fluent-harness-dx/spec.md`

## Summary

Hide DI internals behind a fluent `defineHarness()` API that provides typed agent access, declarative event handling with auto-cleanup, and separation of business logic from presentation. Supports three progressive API levels (`wrapAgent` → simple → full) with mutable state and helper functions (`phase()`, `task()`) for common patterns.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: @anthropic-ai/claude-agent-sdk, @needle-di/core, zod
**Storage**: N/A (state in memory)
**Testing**: bun:test with replay recordings
**Target Platform**: Node.js / Bun
**Project Type**: Single package (monorepo: `packages/sdk`)
**Performance Goals**: N/A (workflow orchestration, not hot path)
**Constraints**: Must maintain backward compatibility with `BaseHarness` and `createContainer()`
**Scale/Scope**: ~50 lines of business logic per workflow (from ~150 lines currently)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Type Safety First** | PASS | Full generic inference via `TAgents`, `TState`, `TInput`, `TResult` type parameters |
| **II. Verified by Reality** | PASS | Will use replay mode with existing recordings for tests |
| **III. DI Discipline** | PASS | Factory functions hide container; users never see `@injectable()` |

No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/007-fluent-harness-dx/
├── plan.md              # This file
├── research.md          # DX decisions (extracted from backlog)
├── data-model.md        # Type definitions
├── quickstart.md        # Usage examples
├── contracts/           # API contracts
└── tasks.md             # Implementation tasks (NOT created by /oharnes.plan)
```

### Source Code (repository root)

```text
packages/sdk/src/
├── core/
│   ├── container.ts       # Existing - no changes
│   ├── event-bus.ts       # Existing - may need event type extensions
│   └── tokens.ts          # Existing - may add new tokens
├── factory/
│   ├── harness-factory.ts  # Existing - keep for backward compat
│   ├── define-harness.ts   # NEW: Main fluent API
│   └── wrap-agent.ts       # NEW: Level 1 one-liner API
├── harness/
│   ├── base-harness.ts     # Existing - keep for backward compat
│   ├── harness-instance.ts # NEW: Running harness with .on()/.run()
│   ├── execute-context.ts  # NEW: Context with phase()/task()/emit()/retry()/parallel()
│   ├── control-flow.ts     # NEW: retry() and parallel() implementations
│   └── event-types.ts      # NEW: Unified event types (includes retry/parallel events)
└── index.ts               # Export new APIs

tests/
├── unit/
│   ├── factory/
│   │   ├── define-harness.test.ts  # NEW
│   │   └── wrap-agent.test.ts      # NEW
│   └── harness/
│       ├── execute-context.test.ts # NEW
│       └── control-flow.test.ts    # NEW: retry/parallel tests
└── integration/
    └── fluent-harness.test.ts      # NEW: E2E with replay
```

**Structure Decision**: Extend existing `packages/sdk` structure. New files under `factory/` and `harness/` following established patterns.

## Complexity Tracking

> No violations - all principles satisfied by design.

## Context Scope

### Include in Agent Context

- `packages/sdk/src/` - main source code
- `packages/sdk/tests/` - existing test patterns
- `specs/007-fluent-harness-dx/` - this feature's specification and plan
- `harnesses/coding/` - reference harness for migration proof

### Exclude from Agent Context

- `listr2/examples/` - external dependency examples (may cause divergence)
- `examples/` - prototype/example code
- `node_modules/`, `dist/`, `build/` - generated/external files
- `specs/backlog/` - backlog documents with implementation details

**Rationale**: The backlog document (006-fluent-harness-dx.md) contains detailed type definitions that were used for planning but should not influence implementation - the spec.md and this plan.md are the sources of truth.

## Verification Gates

### Pre-Commit Gates

- [ ] All tests pass: `bun run test`
- [ ] Type checking passes: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
- [ ] No console.log/debug statements in production code

### Task Completion Gates

- [ ] Task file paths match actual created/modified files
- [ ] Task marked `[X]` in tasks.md
- [ ] New code follows patterns from plan.md Project Structure

### Feature Completion Gates

- [ ] All tasks marked `[X]` in tasks.md
- [ ] All critical file paths exist (see below)
- [ ] Integration test passes with replay recordings
- [ ] `harnesses/coding` migrated to new API as proof-of-concept
- [ ] Backward compatibility: existing `createTaskHarness()` still works

### Critical File Paths

```text
packages/sdk/src/factory/define-harness.ts      # Main fluent API
packages/sdk/src/factory/wrap-agent.ts          # Level 1 API
packages/sdk/src/harness/harness-instance.ts    # Instance with .on()/.run()
packages/sdk/src/harness/execute-context.ts     # Context with helpers
packages/sdk/src/harness/control-flow.ts        # retry() and parallel() implementations
packages/sdk/src/harness/event-types.ts         # Unified events (including retry/parallel)
packages/sdk/src/index.ts                       # Exports updated
tests/unit/factory/define-harness.test.ts       # Unit tests
tests/unit/harness/control-flow.test.ts         # Control flow helper tests
tests/integration/fluent-harness.test.ts        # Integration test
```

### Test Coverage Expectations

- **Minimum line coverage**: 90% for new code (per SC-005)
- **Required test types**: Unit tests for all public APIs, integration test with replay
- **Skip flag**: `--skip-tests` available for iterative development (must pass before merge)

## Architecture Overview

### Current vs Target

**Current**: Three parallel event systems that don't communicate:
1. AgentEvents (SDK-level) → EventBus → NOWHERE (not connected to renderer)
2. HarnessEvents (task-level) → Renderer/Callbacks/Recorder (triple storage)
3. NarrativeEntry → emitNarrative() → Three separate consumers

**Target**: EventBus is the single source of truth:
1. Agents emit to EventBus
2. Harness subscribes via `.on()`
3. Renderer subscribes as external handler
4. Auto-cleanup on `run()` completion

### Implementation Patterns

#### Pattern 1: defineHarness() as Factory

```
defineHarness(config)
└─► returns HarnessFactory { create(input) }
    └─► returns HarnessInstance { on(), run(), state }
        └─► internally: createContainer() + resolveAgents() + manage subscriptions
```

#### Pattern 2: Callbacks Become EventBus Subscribers

- Current: TaskHarness calls callbacks directly
- Target: TaskHarness only publishes to EventBus; callbacks wrap subscriptions

#### Pattern 3: phase()/task() Helpers

- Auto-emit start/complete events
- Handle errors gracefully
- Return the inner function's result

### API Levels

| Level | API | Use Case |
|-------|-----|----------|
| 1 | `wrapAgent(CodingAgent).run(input)` | Single agent, one-liner |
| 2 | `defineHarness({ agents, run })` | Simple workflow, no state |
| 3 | `defineHarness({ agents, state, run/execute })` | Full workflow with state |

### Key Design Decisions

From DX Exploration (resolved):

1. **Dual API** (`run:` + `execute:`): Simple async function OR generator with yields
   - **MUTUALLY EXCLUSIVE**: Provide exactly one, not both
   - TypeScript enforces via discriminated union: `{ run: ... } | { execute: ... }`
   - Level 2 uses `run:` (async function), Level 3 uses `execute:` (async generator)
2. **Hybrid Events**: `phase()`/`task()` helpers + `emit()` escape hatch
   - **LIFECYCLE**: Helpers bound fresh at each `run()` invocation
   - Auto-cleanup when `run()` returns (subscriptions cleared, no state bleed)
   - Each `run()` call gets its own ExecuteContext with isolated helpers
3. **Mutable State**: Direct mutation for simplicity
4. **Progressive Levels**: Three API levels for different complexity needs
5. **Context-Integrated Control Flow**: `retry()` and `parallel()` helpers with auto-emitted events (consistent with phase/task pattern)
