# Implementation Plan: Vercel AI SDK Adapter

**Branch**: `001-vercel-ai-adapter` | **Date**: 2025-01-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-vercel-ai-adapter/spec.md`

## Summary

Create a `ChatTransport` adapter that transforms Open Harness runtime events into Vercel AI SDK v6 `UIMessageChunk` stream format. This enables developers to use the standard `useChat()` hook and AI Elements components with Open Harness multi-agent flows. The adapter maps granular events (`agent:text:delta`, `agent:tool`, `node:start`) to AI SDK streaming chunks (`text-delta`, `tool-input-available`, `step-start`), providing seamless integration without custom client code.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled)  
**Primary Dependencies**: `ai` (Vercel AI SDK v6.0.9), `@open-harness/sdk` (peer dependency)  
**Storage**: N/A (in-memory message accumulation, no persistence)  
**Testing**: `bun:test` for unit tests, integration tests with real runtime  
**Target Platform**: Node.js/Bun server, React browser (via AI SDK hooks)  
**Project Type**: Library package (new package `packages/ai-sdk/` in monorepo)  
**Performance Goals**: <100ms latency from event emission to chunk delivery, handle 100 concurrent streams  
**Constraints**: Must be compatible with AI SDK v6 `ChatTransport` interface, zero client-side code required  
**Scale/Scope**: Single package with ~500 LOC, 4 main modules (transport, transforms, accumulator, types)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Type Safety First ✅

| Requirement | Status | How Addressed |
|-------------|--------|---------------|
| `strict: true` in tsconfig | ✅ | New package inherits monorepo strictness |
| No `any` types | ✅ | Use `unknown` with type guards for event payloads |
| Explicit function signatures | ✅ | All transforms return explicit `UIMessageChunk` types |
| API boundary schemas | ✅ | Zod schemas for transport options if needed |

### II. Verified by Reality ✅

| Requirement | Status | How Addressed |
|-------------|--------|---------------|
| Unit tests for pure logic | ✅ | Transform functions are pure (event → chunk) |
| Real LLM recordings | ✅ | Use existing SDK recordings for runtime events |
| Live integration test | ✅ | Test with real `useChat()` hook in React |
| Golden recordings committed | ✅ | Capture real AI SDK chunk sequences |

### III. Dependency Injection Discipline ✅

| Requirement | Status | How Addressed |
|-------------|--------|---------------|
| Factory functions hide complexity | ✅ | `createOpenHarnessChatTransport(runtime)` |
| Users don't need DI knowledge | ✅ | Simple constructor, no container exposure |
| No circular dependencies | ✅ | Linear: transport → transforms → types |

**Constitution Check Result**: ✅ PASSED - No violations, proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-vercel-ai-adapter/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── transport.ts     # TypeScript interface contract
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/ai-sdk/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Barrel export
│   ├── transport.ts                # OpenHarnessChatTransport class
│   ├── transforms.ts               # Event → Chunk transform functions
│   ├── accumulator.ts              # MessageAccumulator state machine
│   └── types.ts                    # OH-specific types and DataUIParts
└── tests/
    ├── unit/
    │   ├── transforms.test.ts      # Pure transform function tests
    │   └── accumulator.test.ts     # State machine tests
    └── integration/
        └── transport.test.ts       # Full transport with mock runtime

apps/ui/
├── src/
│   └── app/
│       └── demo/                   # Demo page for integration testing
│           └── page.tsx            # useChat() with OpenHarnessChatTransport
```

**Structure Decision**: New package `packages/ai-sdk/` following monorepo conventions. Separate from SDK core to keep peer dependencies optional. Demo page in existing `apps/ui/` for integration testing with real React/Next.js environment.

## Complexity Tracking

> **No violations - section empty**

No constitution violations requiring justification.

## Context Scope

### Include in Agent Context

> Directories and files the implementing agent SHOULD access

- `packages/sdk/src/core/events.ts` - RuntimeEvent types (source of truth)
- `packages/sdk/src/transport/` - Existing transport patterns
- `packages/sdk/src/runtime/runtime.ts` - Runtime interface
- `packages/sdk/tests/` - Existing test patterns
- `apps/ui/node_modules/ai/dist/index.d.ts` - AI SDK types (reference)
- `specs/001-vercel-ai-adapter/` - This feature's spec and plan

### Exclude from Agent Context

> Directories and files the implementing agent should NOT access

- `packages/sdk/examples/` - Example code (if exists)
- `apps/ui/src/app/page.tsx` - Existing UI (avoid contamination)
- `node_modules/` - All node_modules except AI SDK types for reference
- `dist/`, `build/` - Generated files
- `.specify/` - Workflow tooling

**Rationale**: The AI SDK types are needed for reference but the actual implementation should not copy patterns from the existing UI app. The adapter should be a clean implementation following the plan.

## Verification Gates

### Pre-Commit Gates

> Must pass before ANY commit during implementation

- [ ] All tests pass: `bun run test` (in packages/ai-sdk/)
- [ ] Type checking passes: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
- [ ] No console.log/debug statements in production code

### Task Completion Gates

> Verified after each task is marked complete

- [ ] Task file paths match actual created/modified files
- [ ] Task marked `[X]` in tasks.md
- [ ] New code follows patterns from plan.md Project Structure
- [ ] Exports added to index.ts barrel file

### Feature Completion Gates

> Must pass before feature is considered complete

- [ ] All tasks marked `[X]` in tasks.md
- [ ] All critical file paths exist (see below)
- [ ] Integration test passes with real Open Harness runtime
- [ ] Demo page works with `useChat()` hook
- [ ] README.md documents usage

### Critical File Paths

> These files MUST exist at feature completion

```text
packages/ai-sdk/package.json           # Package manifest
packages/ai-sdk/src/index.ts           # Barrel export
packages/ai-sdk/src/transport.ts       # Main transport class
packages/ai-sdk/src/transforms.ts      # Transform functions
packages/ai-sdk/src/accumulator.ts     # State machine
packages/ai-sdk/src/types.ts           # Type definitions
packages/ai-sdk/tests/unit/transforms.test.ts    # Unit tests
packages/ai-sdk/tests/integration/transport.test.ts  # Integration test
apps/ui/src/app/demo/page.tsx          # Demo page
```

### Test Coverage Expectations

- **Minimum line coverage**: 80% for new code (transforms and accumulator are pure functions)
- **Required test types**: Unit tests for all transform functions, integration test with mock runtime
- **Skip flag**: `--skip-tests` available for iterative development (must pass before merge)
