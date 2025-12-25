# Implementation Plan: SDK Validation via Speckit Dogfooding

**Branch**: `002-sdk-validation` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-sdk-validation/spec.md`

## Summary

Build a task execution harness that runs Speckit's own `tasks.md` through SDK agents, validating the SDK by using it for real work. The harness orchestrates three agents (Parser, Coding, Review), each wrapped with monologue, to parse tasks, execute them, and validate completion.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Runtime**: Bun 1.x
**Primary Dependencies**: @anthropic-ai/claude-agent-sdk, @needle-di/core, zod
**Storage**: JSONL files for recordings (`recordings/harness/{sessionId}/`)
**Testing**: bun test (unit + integration with recorder pattern)
**Target Platform**: CLI / Node.js compatible
**Project Type**: Monorepo package extension (packages/sdk/)
**Performance Goals**: Process tasks within API timeout limits; per-task timeout configurable
**Constraints**: Fail-fast default, per-task timeout, exponential backoff for rate limits
**Scale/Scope**: ~70 tasks in tasks.md, single harness execution at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Type Safety First

| Requirement | Compliance |
|-------------|------------|
| strict: true in tsconfig | ✅ Existing SDK uses strict mode |
| No `any` types | ✅ All new entities will use Zod schemas |
| Explicit function signatures | ✅ Will define typed interfaces for all agents/harness |
| API boundaries validated | ✅ ParsedTask, ValidationResult schemas with Zod |
| Discriminated unions | ✅ TaskStatus union: "pending" \| "in-progress" \| "complete" \| "validated" \| "failed" |

### II. Verified by Reality

| Requirement | Compliance |
|-------------|------------|
| Unit tests for pure logic only | ✅ Task parsing, dependency sorting testable in isolation |
| Recorder pattern for agent code | ✅ FR-030/031 require recording/replay support |
| Fixtures from real LLM calls | ✅ Golden recordings in recordings/harness/golden/ |
| Live integration test | ✅ SC-002 requires harness to execute real tasks |
| Golden recordings committed | ✅ FR-032 defines recording location |

### III. DI Discipline

| Requirement | Compliance |
|-------------|------------|
| @injectable() with inject(Token) | ✅ ParserAgent, TaskHarness will follow pattern |
| Composition root only | ✅ New bindings added to container.ts |
| No circular dependencies | ✅ Harness → Agents (one direction) |
| Factory functions hide DI | ✅ createTaskHarness() factory will be provided |
| Users don't need DI knowledge | ✅ Factory handles container setup |

**Gate Status**: ✅ PASS - No violations

## Project Structure

### Documentation (this feature)

```text
specs/002-sdk-validation/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (internal interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/sdk/
├── src/
│   ├── agents/
│   │   ├── parser-agent.ts          # NEW: Task parser agent
│   │   └── parser-agent.prompt.md   # NEW: Parser agent prompt
│   ├── harness/
│   │   ├── task-harness.ts          # NEW: Task execution harness
│   │   ├── task-state.ts            # NEW: Harness state management
│   │   └── types.ts                 # EXTEND: Add task harness types
│   ├── core/
│   │   ├── container.ts             # EXTEND: Add ParserAgent, TaskHarness bindings
│   │   └── tokens.ts                # EXTEND: Add new DI tokens
│   ├── factory/
│   │   └── harness-factory.ts       # NEW: createTaskHarness() factory
│   └── index.ts                     # EXTEND: Export new components
├── tests/
│   ├── unit/
│   │   ├── parser-agent.test.ts     # NEW: Parser logic tests
│   │   └── task-harness.test.ts     # NEW: Harness state tests
│   └── integration/
│       └── task-harness.test.ts     # NEW: Live harness test
├── prompts/
│   └── monologue.md                 # COMPLETE: Missing from 001-sdk-core
└── recordings/
    └── harness/
        └── golden/                  # NEW: Golden recordings for harness
```

**Structure Decision**: Extends existing packages/sdk/ structure. New ParserAgent follows agent pattern in src/agents/. TaskHarness extends BaseHarness pattern in src/harness/.

## Complexity Tracking

> No violations - table not needed.

---

## Architectural Decisions

### AD-001: Parser Agent as Structured Output Agent

**Decision**: Create ParserAgent extending BaseAnthropicAgent with Zod-validated structured output.

**Rationale**:
- Demonstrates SDK's structured output capability
- Type-safe task parsing with validation
- Follows existing agent patterns (CodingAgent, ReviewAgent)

### AD-002: TaskHarness Extends BaseHarness

**Decision**: TaskHarness extends BaseHarness, adding task-specific state management.

**Rationale**:
- Reuses existing harness infrastructure
- Adds: task queue, retry tracking, timeout handling
- Consistent with 001-sdk-core patterns

### AD-003: Unified Narrative Stream

**Decision**: Harness aggregates all agent narratives into single callback stream.

**Rationale**:
- User sees one coherent story, not three separate agent streams
- Harness controls narrative timing and handoff language
- Easier to record/replay as single stream

### AD-004: State Persistence via JSONL

**Decision**: Harness state serialized to JSONL for checkpoint/resume.

**Rationale**:
- Consistent with recording format
- Human-readable for debugging
- Append-only for crash recovery
