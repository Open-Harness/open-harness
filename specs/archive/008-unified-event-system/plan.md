# Implementation Plan: Unified Event System

**Branch**: `008-unified-event-system` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-unified-event-system/spec.md`

**Note**: This template is filled in by the `/oharnes.plan` command.

## Summary

Unify `AgentEvent` (SDK-level: thinking, tool calls) and `HarnessEvent` (workflow-level: phases, tasks) into a single `UnifiedEventBus` using Node.js `AsyncLocalStorage` for automatic context propagation. Events automatically inherit contextual information (session, phase, task, agent) without explicit passing, enabling renderers to show "agent is thinking while executing task T003".

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: @anthropic-ai/claude-agent-sdk, @needle-di/core, zod, node:async_hooks (AsyncLocalStorage)
**Storage**: N/A (in-memory event bus, no persistence)
**Testing**: bun:test with coverage
**Target Platform**: Node.js 18+ / Bun (AsyncLocalStorage required)
**Project Type**: single (packages/sdk)
**Performance Goals**: ~5-10% overhead acceptable per spec assumptions
**Constraints**: Node.js/Bun only (no browser support per non-goals)
**Scale/Scope**: N/A

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Type Safety First

| Principle | Compliance | Notes |
|-----------|------------|-------|
| `strict: true` | ✅ PASS | Already enforced project-wide |
| `any` forbidden | ✅ PASS | Use `unknown` with type guards for event payloads |
| Explicit function signatures | ✅ PASS | All public APIs will have explicit types |
| Validated schemas (Zod) | ✅ PASS | EventContext and EnrichedEvent schemas via Zod |
| Discriminated unions | ✅ PASS | BaseEvent as discriminated union with `type` field |

### II. Verified by Reality

| Principle | Compliance | Notes |
|-----------|------------|-------|
| Unit tests for pure logic | ✅ PASS | EventBus emit/subscribe are pure logic |
| Recorder pattern for LLM code | ✅ PASS | Integration tests use existing recorder |
| Fixtures from real calls | ✅ PASS | Will capture real agent events in golden recordings |
| Live integration test | ✅ PASS | SC-007 tests console renderer with real harness |
| Golden recordings committed | ✅ PASS | New recordings in recordings/golden/ |

### III. Dependency Injection Discipline

| Principle | Compliance | Notes |
|-----------|------------|-------|
| @injectable() pattern | ✅ PASS | UnifiedEventBus will be @injectable() |
| Composition root binds | ✅ PASS | Bind in container.ts |
| No circular deps | ⚠️ MONITOR | Bus → Agents → Bus possible; use tokens to break cycle |
| Factory hides DI | ✅ PASS | defineRenderer() hides container complexity |
| Users don't see DI | ✅ PASS | Public API is bus.subscribe(), defineRenderer() |

### IV. Tool Patterns (Bun CLI)

| Principle | Compliance | Notes |
|-----------|------------|-------|
| Use `bun run test` | ✅ PASS | Tests use package.json scripts |

**Pre-Research Gate Status**: ✅ PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/008-unified-event-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── unified-event-bus.ts
└── tasks.md             # Phase 2 output (/oharnes.tasks command)
```

### Source Code (repository root)

```text
packages/sdk/src/
├── core/
│   ├── event-bus.ts           # Existing EventBus (modify for delegation)
│   ├── unified-event-bus.ts   # NEW: UnifiedEventBus with AsyncLocalStorage
│   ├── tokens.ts              # Add IUnifiedEventBus token
│   └── container.ts           # Bind UnifiedEventBus
├── harness/
│   ├── harness-instance.ts    # Modify to use unified bus
│   ├── event-types.ts         # Extend with context types
│   └── define-renderer.ts     # NEW: defineRenderer() factory
├── providers/anthropic/runner/
│   ├── base-agent.ts          # Inject unified bus, emit with context
│   └── event-mapper.ts        # Map SDK events to unified format
└── index.ts                   # Export unified APIs

packages/sdk/tests/
├── unit/
│   ├── unified-event-bus.test.ts      # NEW: Core bus tests
│   └── define-renderer.test.ts        # NEW: Renderer factory tests
├── integration/
│   └── unified-events.test.ts         # NEW: End-to-end event flow
└── fixtures/
    └── unified-events/                # NEW: Golden recordings
```

**Structure Decision**: Single package (packages/sdk) following existing patterns. New unified event infrastructure lives in `core/`, renderer API in `harness/`, agent integration in `providers/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

## Context Scope

### Include in Agent Context

> Directories and files the implementing agent SHOULD access

- `packages/sdk/src/core/` - Core infrastructure (EventBus, tokens, container)
- `packages/sdk/src/harness/` - Harness infrastructure (HarnessInstance, event types)
- `packages/sdk/src/providers/anthropic/runner/` - Agent event emission
- `specs/008-unified-event-system/` - This feature's specification and plan
- `packages/sdk/tests/` - Existing test patterns

### Exclude from Agent Context

> Directories and files the implementing agent should NOT access (prototype isolation)

- `examples/` - Example harnesses (may influence architecture incorrectly)
- `harnesses/` - Production harnesses (separate concern)
- `listr2/examples/` - External library examples
- `node_modules/`, `dist/`, `build/` - Generated/external files
- `specs/003-harness-renderer/` - Old prototype code

**Rationale**: The existing EventBus and HarnessInstance code is the authoritative source. Exclude example harnesses to prevent implementation drift toward specific use cases rather than the general unified system.

## Verification Gates

### Pre-Commit Gates

> Must pass before ANY commit during implementation

- [ ] All tests pass: `cd packages/sdk && bun run test`
- [ ] Type checking passes: `cd packages/sdk && bun run typecheck`
- [ ] Linting passes: `cd packages/sdk && bun run lint`
- [ ] No console.log/debug statements in production code (except designated error handlers)

### Task Completion Gates

> Verified after each task is marked complete

- [ ] Task file paths match actual created/modified files
- [ ] Task marked `[X]` in tasks.md
- [ ] New code follows patterns from plan.md Project Structure

### Feature Completion Gates

> Must pass before feature is considered complete

- [ ] All tasks marked `[X]` in tasks.md
- [ ] All critical file paths exist (see below)
- [ ] Integration test passes: `cd packages/sdk && bun run test:live`
- [ ] Existing harness.on() tests still pass (backward compatibility)
- [ ] SC-006 coverage gate: ≥90% line coverage for unified-event-bus.ts

### Critical File Paths

> These files MUST exist at feature completion (validates against tasks.md paths)

```text
packages/sdk/src/core/unified-event-bus.ts          # Core UnifiedEventBus class
packages/sdk/src/harness/define-renderer.ts         # defineRenderer() factory
packages/sdk/src/harness/event-context.ts           # EventContext types
packages/sdk/tests/unit/unified-event-bus.test.ts   # Unit tests for bus
packages/sdk/tests/unit/define-renderer.test.ts     # Unit tests for renderer factory
packages/sdk/tests/integration/unified-events.test.ts # E2E integration test
```

### Test Coverage Expectations

- **Minimum line coverage**: 90% for unified-event-bus.ts (per SC-006)
- **Required test types**: Unit tests for pure logic, integration tests for context propagation
- **Skip flag**: `--skip-tests` available for iterative development (must pass before merge)
