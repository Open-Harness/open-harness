# Implementation Plan: Monologue System

**Branch**: `005-monologue-system` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-monologue-system/spec.md`

## Summary

Implement a decorator-based monologue system that generates human-readable, first-person narratives from agent events. The `@Monologue('scope')` decorator wraps agent methods, buffers events, calls a cheap LLM (Haiku) to synthesize narratives, and emits them via the existing `IEventBus`. This replaces 30+ manual `emitNarrative()` calls in TaskHarness with automatic, LLM-generated narratives.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: @anthropic-ai/sdk (NEW), @needle-di/core, zod
**Storage**: N/A (in-memory buffer, history ephemeral per-session)
**Testing**: bun:test with mock LLM injection
**Target Platform**: Node.js (Bun runtime)
**Project Type**: single (SDK library)
**Performance Goals**: Narrative generation <500ms per invocation, no blocking of task execution
**Constraints**: Must work with existing IEventBus, must not block agent execution on LLM failures
**Scale/Scope**: Per-session buffer (5-10 events), history window (5 narratives)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **Type Safety First** | ✓ | All interfaces typed (IMonologueLLM, MonologueConfig, AgentEvent, NarrativeEntry) |
| **Verified by Reality** | ✓ | E2E test with real Haiku calls required; recorder pattern for TDD |
| **DI Discipline** | ✓ | MonologueService injectable; IMonologueLLM token for testability |

No violations anticipated.

## Project Structure

### Documentation (this feature)

```text
specs/005-monologue-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (from /oharnes.tasks)
```

### Source Code (repository root)

```text
packages/sdk/src/
├── monologue/
│   ├── index.ts               # Barrel export
│   ├── types.ts               # MonologueConfig, AgentEvent, NarrativeEntry
│   ├── tokens.ts              # IMonologueLLM token, IMonologueService token
│   ├── monologue-service.ts   # Core service (buffer, flush, history)
│   ├── monologue-decorator.ts # @Monologue() decorator implementation
│   ├── prompts.ts             # DEFAULT, TERSE, VERBOSE preset prompts
│   └── anthropic-llm.ts       # Production IMonologueLLM implementation (Haiku)
├── core/
│   ├── container.ts           # Add monologue bindings (IMonologueLLMToken, IMonologueServiceToken)
│   └── tokens.ts              # Export new tokens
└── harness/
    └── task-harness.ts        # Migrate from manual emitNarrative() to @Monologue

tests/
├── unit/
│   └── monologue/
│       ├── monologue-service.test.ts
│       └── monologue-decorator.test.ts
└── integration/
    └── monologue/
        └── e2e-narrative.test.ts
```

**Structure Decision**: Single project layout under `packages/sdk/`. New `monologue/` module follows existing patterns from `harness/`, `core/`, `providers/`.

## Complexity Tracking

> No constitution violations anticipated. This section left empty.

## Context Scope

### Include in Agent Context

- `packages/sdk/src/` - main source code
- `specs/005-monologue-system/` - this feature's specification and plan
- `packages/sdk/tests/` - existing test patterns
- `specs/003-harness-renderer/contracts/monologue-config.ts` - existing config contract (reference only)

### Exclude from Agent Context

- `listr2/` - external library (architectural contamination risk)
- `examples/` - prototype/example code
- `*.spike.*` - spike branches
- `**/prototype/` - prototype directories
- `node_modules/`, `dist/`, `build/` - generated files

**Rationale**: The listr2 examples directory contains renderer prototypes that could cause architectural divergence from the spec-defined approach.

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
- [ ] Integration test passes with real Haiku calls
- [ ] Zero manual emitNarrative() calls remain in TaskHarness

### Critical File Paths

```text
packages/sdk/src/monologue/index.ts           # Barrel export
packages/sdk/src/monologue/types.ts           # Type definitions
packages/sdk/src/monologue/tokens.ts          # DI tokens
packages/sdk/src/monologue/monologue-service.ts
packages/sdk/src/monologue/monologue-decorator.ts
packages/sdk/src/monologue/prompts.ts
packages/sdk/src/monologue/anthropic-llm.ts
tests/unit/monologue/monologue-service.test.ts
tests/integration/monologue/e2e-narrative.test.ts
```

### Test Coverage Expectations

- **Minimum line coverage**: 80% for monologue module
- **Required test types**: Unit tests for service/decorator, E2E test with real Haiku
- **Skip flag**: `--skip-tests` available but must pass before merge

---

## Research Decisions (from [research.md](./research.md))

All unknowns have been resolved:

| Decision | Choice | Summary |
|----------|--------|---------|
| **Interception Pattern** | EventBus subscription | Decorator subscribes to IEventBus with agent-scoped filter. No conflict with @Record. |
| **Buffer Flush Timing** | LLM-driven with guardrails | The LLM decides when to narrate. Thresholds (min/max) are limits, not triggers. |
| **Concurrent Isolation** | Decorator closure | Buffer state stored per-decorated-method. Each call has isolated scope. |
| **LLM API Pattern** | Direct @anthropic-ai/sdk | Simple completion, not full agent SDK. Fast, minimal overhead. |
| **Migration Strategy** | **Separate Systems** | Harness emits progress events. Agents emit narratives via @Monologue. |

### Key Architectural Insight

**Narratives ≠ Progress Events**

| Concept | Source | Content | API |
|---------|--------|---------|-----|
| **Narratives** | Agents (Parser, Coder, Reviewer) | LLM-synthesized first-person summaries | `@Monologue` decorator |
| **Progress Events** | Harness (orchestrator) | Deterministic status updates | `emitEvent({ type: "harness:status" })` |

Harness is NOT an agent. It doesn't produce "narratives" - it produces status updates. This separation eliminates the confusion of hardcoded strings pretending to be LLM-generated content.

### New Dependency

**Add**: `@anthropic-ai/sdk` - Direct Anthropic API for simple completions (narratives only)
