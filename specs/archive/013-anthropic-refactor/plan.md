# Implementation Plan: Anthropic Package Architecture Refactor

**Branch**: `013-anthropic-refactor` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-anthropic-refactor/spec.md`

**Note**: This template is filled in by the `/oharnes.plan` command.

## Summary

Refactor `@openharness/anthropic` from a flat class-based architecture to a three-layer functional design (infra/provider/presets) with `defineAnthropicAgent()` factory. This eliminates class hierarchy boilerplate, removes Bun-specific file I/O for prompts, and establishes clear framework/application boundaries.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: @anthropic-ai/claude-agent-sdk, @anthropic-ai/sdk, @needle-di/core, zod
**Storage**: N/A (no persistence layer in this package)
**Testing**: bun test (unit + replay tests)
**Target Platform**: Node.js 18+ and Bun 1.x (dual runtime support - FR-004)
**Project Type**: Single package within monorepo (`packages/anthropic/`)
**Performance Goals**: N/A (framework refactor, not performance-critical)
**Constraints**: Must maintain backward compatibility warnings for 1 major version (Risk mitigation)
**Scale/Scope**: Single package, ~15 source files, 3 layer architecture

### Technical Unknowns (NEEDS CLARIFICATION)

1. **Factory Internal Structure**: How should `defineAnthropicAgent()` internally create the DI container and wire dependencies without exposing Needle DI to users?
2. **Prompt Template Type Safety**: What's the best pattern for `PromptTemplate<TData>` to enforce type safety between input schema and template variables?
3. **Decorator Compatibility**: How do `@Monologue` and `@Record` decorators attach to factory-produced agents (FR-004)?
4. **Dual Event Bus Removal**: What migration path removes legacy `IEventBus` while keeping `IUnifiedEventBus` (FR-004d)?

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Type Safety First** | ✅ PASS | `defineAnthropicAgent<TInput, TOutput>()` enforces typed schemas; `PromptTemplate<TData>` provides compile-time template validation; Zod schemas at API boundaries |
| **II. Verified by Reality** | ✅ PASS | Existing replay tests remain valid; factory wraps same runner infrastructure; recording attaches at runner level not agent level |
| **III. DI Discipline** | ✅ PASS | Factory pattern explicitly hides DI from users (Constitution requirement); internal services remain `@injectable()`; users never see Needle DI |

**Pre-Design Gate**: PASS - No constitutional violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/013-anthropic-refactor/
├── plan.md              # This file (/oharnes.plan command output)
├── research.md          # Phase 0 output (/oharnes.plan command)
├── data-model.md        # Phase 1 output (/oharnes.plan command)
├── quickstart.md        # Phase 1 output (/oharnes.plan command)
├── contracts/           # Phase 1 output (/oharnes.plan command)
└── tasks.md             # Phase 2 output (/oharnes.tasks command - NOT created by /oharnes.plan)
```

### Source Code (repository root)

```text
packages/anthropic/src/
├── infra/                    # Layer 1: Runtime infrastructure (NEW)
│   ├── runner/               # Moved from src/runner/
│   │   ├── anthropic-runner.ts
│   │   ├── event-mapper.ts
│   │   └── models.ts
│   ├── recording/            # Moved from src/recording/
│   │   ├── decorators.ts
│   │   ├── recording-factory.ts
│   │   ├── replay-runner.ts
│   │   ├── types.ts
│   │   └── vault.ts
│   └── monologue/            # Moved from src/monologue/
│       └── anthropic-llm.ts
│
├── provider/                 # Layer 2: Anthropic provider (NEW)
│   ├── factory.ts            # defineAnthropicAgent() implementation
│   ├── types.ts              # AnthropicAgentDefinition, PromptTemplate
│   ├── internal-agent.ts     # InternalAnthropicAgent (NOT exported)
│   └── prompt-template.ts    # createPromptTemplate() helper
│
├── presets/                  # Layer 3: Pre-built agents (NEW)
│   ├── index.ts              # Preset barrel export
│   ├── coding-agent.ts       # CodingAgent preset
│   ├── review-agent.ts       # ReviewAgent preset
│   ├── planner-agent.ts      # PlannerAgent preset
│   └── prompts/              # Co-located TypeScript prompt templates
│       ├── coding.ts
│       ├── review.ts
│       └── planner.ts
│
└── index.ts                  # Main export: defineAnthropicAgent, types, prompt utils

packages/anthropic/tests/
├── unit/
│   ├── factory.test.ts       # defineAnthropicAgent unit tests
│   └── prompt-template.test.ts
├── integration/
│   └── presets.test.ts       # Preset agent integration tests
└── replay/                   # Existing replay tests (preserved)
```

**Structure Decision**: Three-layer architecture matching FR-001. `infra/` contains runtime concerns (runner, recording, monologue), `provider/` contains the factory and type definitions, `presets/` contains pre-built agents with co-located prompts. Main index exports only framework primitives; presets require explicit `/presets` subpath import (FR-002).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations - Constitution Check passed.*

## Context Scope

### Include in Agent Context

> Directories and files the implementing agent SHOULD access

- `packages/anthropic/src/` - existing source code to refactor
- `packages/anthropic/tests/` - existing test patterns
- `packages/sdk/src/` - core SDK types (IAgentRunner, IUnifiedEventBus, etc.)
- `specs/013-anthropic-refactor/` - this feature's specification and plan
- `.knowledge/docs/` - canonical documentation for reference

### Exclude from Agent Context

> Directories and files the implementing agent should NOT access (prototype isolation)

- `specs/012-define-anthropic-agent/` - superseded spec (may cause confusion)
- `packages/anthropic/src/agents/*.prompt.md` - old markdown prompts being replaced
- `examples/` - prototype/example code
- `node_modules/`, `dist/`, `build/` - generated/external files
- `.knowledge/private/` - investor materials (not relevant)

**Rationale**: The old spec (012) and markdown prompt files represent the architecture being replaced. Including them in context could cause the agent to preserve patterns we're explicitly removing.

## Verification Gates

### Pre-Commit Gates

> Must pass before ANY commit during implementation

- [ ] All tests pass: `bun run test` (in packages/anthropic/)
- [ ] Type checking passes: `bun run typecheck`
- [ ] No console.log/debug statements in production code
- [ ] Backward compatibility warning added for deprecated exports

### Task Completion Gates

> Verified after each task is marked complete

- [ ] Task file paths match actual created/modified files
- [ ] Task marked `[X]` in tasks.md
- [ ] New code follows three-layer structure from plan.md

### Feature Completion Gates

> Must pass before feature is considered complete

- [ ] All tasks marked `[X]` in tasks.md
- [ ] All critical file paths exist (see below)
- [ ] Integration test passes with real LLM (replay tests)
- [ ] `defineAnthropicAgent()` works in both Node.js and Bun
- [ ] Package.json exports updated for `/presets` subpath

### Critical File Paths

> These files MUST exist at feature completion (validates against tasks.md paths)

```text
packages/anthropic/src/provider/factory.ts       # defineAnthropicAgent()
packages/anthropic/src/provider/types.ts         # AnthropicAgentDefinition, PromptTemplate
packages/anthropic/src/provider/prompt-template.ts # createPromptTemplate()
packages/anthropic/src/presets/index.ts          # Preset barrel export
packages/anthropic/src/presets/coding-agent.ts   # CodingAgent preset
packages/anthropic/src/index.ts                  # Main export (updated)
packages/anthropic/tests/unit/factory.test.ts    # Factory unit tests
```

### Test Coverage Expectations

- **Minimum line coverage**: 70% for new code in `provider/`
- **Required test types**: Unit tests for factory, replay tests for presets
- **Skip flag**: `--skip-tests` available for iterative development (must pass before merge)
