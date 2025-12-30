# Implementation Plan: Transport Architecture

**Branch**: `010-transport-architecture` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-transport-architecture/spec.md`

## Summary

Unify event emission, subscription, and bidirectional communication under a single Transport interface. HarnessInstance will implement Transport directly, providing both event subscription (already exists via `.on()`) and command methods (`send`, `reply`, `abort`). Consumers attach via `(transport) => cleanup` functions for maximum flexibility.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: @anthropic-ai/claude-agent-sdk, @needle-di/core, zod
**Storage**: N/A (in-memory event bus, message queues)
**Testing**: bun:test (unit + replay tests)
**Target Platform**: Node.js 18+/Bun
**Project Type**: single (packages/sdk)
**Performance Goals**: 1000 events/sec throughput, <100ms prompt round-trip
**Constraints**: Must maintain backward compatibility with existing HarnessInstance API
**Scale/Scope**: SDK library - used by harness authors

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| **I. Type Safety First** | PASS | All interfaces typed with Zod schemas for runtime validation at API boundaries |
| **II. Verified by Reality** | PASS | Will use recorder pattern for interactive session tests; unit tests for pure logic |
| **III. Dependency Injection Discipline** | PASS | Transport exposed via HarnessInstance factory; DI hidden from users |

**Pre-Design Gate**: PASSED - No constitutional violations.

## Project Structure

### Documentation (this feature)

```text
specs/010-transport-architecture/
├── plan.md              # This file
├── research.md          # Phase 0 output (minimal - no unknowns)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/oharnes.tasks command)
```

### Source Code (repository root)

```text
packages/sdk/src/
├── core/
│   ├── unified-event-bus.ts    # Existing - no changes needed
│   └── unified-events/
│       ├── types.ts            # MODIFY: Add Transport, Attachment types
│       ├── filter.ts           # Existing - no changes needed
│       └── index.ts            # Existing - re-export new types
├── harness/
│   ├── harness-instance.ts     # MODIFY: Extend with Transport interface
│   ├── session-context.ts      # CREATE: SessionContext for workflows
│   ├── async-queue.ts          # CREATE: Message queue for injected messages
│   ├── define-renderer.ts      # MODIFY: Return Attachment type
│   └── event-context.ts        # MODIFY: Add session event types
├── factory/
│   └── define-harness.ts       # MODIFY: Add startSession(), complete() support

packages/sdk/tests/
├── unit/
│   ├── transport.test.ts       # CREATE: Transport interface tests
│   ├── session-context.test.ts # CREATE: SessionContext tests
│   └── async-queue.test.ts     # CREATE: AsyncQueue tests
└── replay/
    └── interactive-session.test.ts # CREATE: Interactive session replay tests
```

**Structure Decision**: Single project under `packages/sdk`. This extends the existing harness implementation without new packages.

## Complexity Tracking

> No constitutional violations require justification.

## Context Scope

### Include in Agent Context

- `packages/sdk/src/` - main source code
- `specs/010-transport-architecture/` - this feature's specification and plan
- `packages/sdk/tests/` - existing test patterns
- `packages/sdk/src/harness/harness-instance.ts` - primary file to extend
- `packages/sdk/src/core/unified-event-bus.ts` - event bus integration point

### Exclude from Agent Context

- `examples/` - prototype/example code
- `node_modules/`, `dist/`, `build/` - generated/external files
- `listr2/` - external library examples
- `specs/ready/` - superseded specs (interactive-sessions.md, unified-events.md)

**Rationale**: The superseded specs in specs/ready/ should not influence implementation - they're replaced by this unified design.

## Verification Gates

### Pre-Commit Gates

> Must pass before ANY commit during implementation

- [ ] All tests pass: `bun run test`
- [ ] Type checking passes: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
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
- [ ] Backward compatibility: existing tests pass without modification
- [ ] Interactive session round-trip test passes
- [ ] Documentation updated for public API

### Critical File Paths

> These files MUST exist at feature completion

```text
packages/sdk/src/harness/harness-instance.ts  # Extended with Transport
packages/sdk/src/harness/session-context.ts   # SessionContext implementation
packages/sdk/src/harness/async-queue.ts       # Message queue
packages/sdk/tests/unit/transport.test.ts     # Transport unit tests
packages/sdk/tests/unit/session-context.test.ts # Session tests
```

### Test Coverage Expectations

- **Minimum line coverage**: 80% for new code
- **Required test types**:
  - Unit tests for Transport interface methods
  - Unit tests for SessionContext
  - Replay tests for interactive session workflows
- **Skip flag**: `--skip-tests` available for iterative development (must pass before merge)
