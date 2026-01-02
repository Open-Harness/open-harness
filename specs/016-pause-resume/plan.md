# Implementation Plan: Flow Pause/Resume with Session Persistence

**Branch**: `016-pause-resume` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-pause-resume/spec.md`

## Summary

Enable flow execution pause/resume with session persistence. Extends Hub with `hub.abort({resumable: true})` to pause (vs terminate), stores session state, and adds `hub.resume(sessionId, message?)` to continue execution. Connects existing orphaned `SessionContext` infrastructure to Hub and Executor.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled in tsconfig.json)
**Primary Dependencies**: @anthropic-ai/claude-agent-sdk ^0.1.76, zod ^4.2.1, yaml ^2.4.5
**Storage**: In-memory (Map-based session state store, no persistence to disk per spec assumptions)
**Testing**: bun test (unit + replay tests), vitest for assertions
**Target Platform**: Node.js/Bun runtime (ES2022 target)
**Project Type**: Monorepo package (`packages/kernel`)
**Performance Goals**: <100ms overhead for pause/resume operations (per SC-001)
**Constraints**: Single flow per hub instance, session state survives in memory only
**Scale/Scope**: Single package modification (~1000 LOC change estimate)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Reference**: `.specify/memory/constitution.md`

| Principle | Check | Status |
|-----------|-------|--------|
| I. Event-Driven Architecture | All new components communicate via Hub? | ✅ All pause/resume operations emit events (`flow:paused`, `flow:resumed`). State changes observable via existing channel infrastructure. |
| II. TypeScript Strict Mode | tsconfig.json has `strict: true`? Zod schemas at boundaries? | ✅ Confirmed `strict: true`. Will add Zod schemas for SessionState, PauseSignal, ResumeRequest. |
| III. Test-First Development | Test strategy defined? Golden fixtures if AI involved? | ✅ Unit tests for state transitions, replay tests for pause/resume sequences. No new AI behavior (reuses existing claude.agent). |
| IV. Specification-Driven Workflow | spec.md exists and validated? | ✅ spec.md complete with 4 user stories, 13 FRs, 5 success criteria. |
| V. Simplicity & YAGNI | No premature abstractions? Current use case justifies each component? | ✅ Connects existing orphaned SessionContext rather than creating new abstractions. In-memory only per assumptions. |

**If any check fails**: Document justification in Complexity Tracking section below.

## Project Structure

### Documentation (this feature)

```text
specs/016-pause-resume/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/oharnes.tasks command)
```

### Source Code (repository root)

```text
packages/kernel/
├── src/
│   ├── protocol/
│   │   ├── hub.ts           # MODIFY: Add pause/resume method signatures, PauseOptions type
│   │   ├── session.ts       # MODIFY: Extend SessionContext with pause state
│   │   ├── events.ts        # MODIFY: Add flow:paused, flow:resumed event types
│   │   └── flow-runtime.ts  # MODIFY: Add SessionState, PauseSignal, ResumeRequest types
│   ├── engine/
│   │   ├── hub.ts           # MODIFY: Implement pause/resume, session state store
│   │   └── session-store.ts # NEW: In-memory session state management
│   └── flow/
│       └── executor.ts      # MODIFY: Add abort signal checks, pause point handling
├── tests/
│   ├── unit/
│   │   └── pause-resume.test.ts  # NEW: Unit tests for pause/resume state machine
│   └── replay/
│       └── pause-resume.test.ts  # NEW: Replay tests for pause/resume sequences
```

**Structure Decision**: Extend existing kernel package. No new packages needed - pause/resume is core Hub functionality. Follows existing pattern where protocol/ defines types and engine/ implements them.

### Documentation Updates

```text
apps/docs/content/docs/reference/kernel-spec/
├── spec/
│   ├── hub.mdx              # MODIFY: Add abort({resumable}), resume(), getAbortSignal() docs
│   └── flow-runtime.mdx     # MODIFY: Add pause/resume lifecycle, SessionState reference
├── reference/
│   └── protocol-types.mdx   # MODIFY: Add SessionState, PauseOptions, flow:paused/resumed events
└── flow/
    └── node-catalog.mdx     # MODIFY: Note agent nodes support cooperative pause via AbortSignal
```

**Documentation Requirements**:
- Hub commands: Document new `abort({resumable})` overload, `resume(sessionId, msg?)`, `getAbortSignal()`
- Events: Document `flow:paused` and `flow:resumed` event schemas
- Types: Document `SessionState`, `PauseOptions`, `HubStatus` extension
- Flow runtime: Document pause/resume lifecycle and session state persistence
- Node behavior: Note that agent nodes check AbortSignal for cooperative cancellation

## Gap Analysis (Validated 2026-01-02)

*Validated by reading actual source code, not assumptions.*

### What EXISTS Today

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| `SessionContext` with `AbortController` | `protocol/session.ts:10-19` | ✅ Exists | Has `abortController`, `sessionId`, helper functions |
| `Hub.abort(reason?)` | `engine/hub.ts:146-153` | ✅ Exists | Hard-coded to emit `session:abort`, set status `aborted` |
| `HubStatus` enum | `protocol/hub.ts` | ✅ Partial | `idle/running/complete/aborted` - missing `paused` |
| Multi-turn agent support | `providers/claude.ts:100-107` | ✅ Ready | `messageStream()` yields `SDKUserMessage` with sessionId |
| Channel system | `engine/hub.ts` | ✅ Ready | `subscribe()`, `emit()`, `registerChannel()` work |
| Event infrastructure | `engine/hub.ts` | ✅ Ready | All events routed through Hub |
| Executor node loop | `flow/executor.ts:336` | ✅ Exists | Loops through `compiled.order` |
| `session:message` routing | `engine/hub.ts` | ✅ Exists | `sendToRun(runId, msg)` emits events |
| `NodeRunContext` | `protocol/flow.ts:85-88` | ✅ Exists | Nodes get `{ hub, runId }` |

### What's MISSING

| Component | Location | Gap | FR Reference |
|-----------|----------|-----|--------------|
| `"paused"` in HubStatus | `protocol/hub.ts` | Not in union type | FR-010 |
| `hub.resume(sessionId, msg?)` | `engine/hub.ts` | Method doesn't exist | FR-004 |
| `hub.getAbortSignal()` | `engine/hub.ts` | Method doesn't exist | FR-008 |
| `_pausedSessions` Map | `engine/hub.ts` | No session state storage | FR-005 |
| Resumable abort option | `engine/hub.ts` | `abort({resumable})` not supported | FR-001 |
| Abort signal checks in executor | `flow/executor.ts` | No checks between nodes | FR-007 |
| Abort signal checks in agent | `providers/claude.ts` | No checks in for-await loop | FR-008 |
| `flow:paused` event type | `protocol/events.ts` | Missing | FR-001 |
| `flow:resumed` event type | `protocol/events.ts` | Missing | FR-004 |
| `SessionState` interface | `protocol/flow-runtime.ts` | Not defined | FR-005 |
| Hub owns SessionContext | `engine/hub.ts` | SessionContext is orphaned | FR-013 |

### Key Architectural Insight

**SessionContext exists but is disconnected from Hub.** The abort signal infrastructure is already built (`AbortController`, `isSessionAborted()`, `abortSession()`), but:

1. Hub doesn't create/own SessionContext
2. Executor doesn't receive abort signal
3. `hub.abort()` doesn't call `abortController.abort()`

The implementation work is primarily **wiring**, not new abstractions.

## Complexity Tracking

> **No violations - design follows existing patterns**

## Verification Gates

*Gates executed by `/oharnes.verify` post-implementation.*

### Gate 1: Type Safety
- **Command**: `cd packages/kernel && bun run typecheck`
- **Pass Criteria**: Zero TypeScript errors, all strict mode checks pass
- **What it validates**: SessionState types, PauseOptions interfaces, Hub method signatures, event type discriminators

### Gate 2: Unit Tests
- **Command**: `bun test tests/unit/pause-resume.test.ts`
- **Pass Criteria**: All tests pass, ≥90% coverage of pause/resume state machine
- **What it validates**:
  - State transitions (idle → running → paused → running → complete)
  - Session storage and retrieval
  - Error conditions (SessionNotFoundError, duplicate resume)
  - Message queueing during pause

### Gate 3: Replay Tests
- **Command**: `bun test tests/replay/pause-resume.test.ts`
- **Pass Criteria**: All replay fixtures match golden outputs
- **What it validates**:
  - Pause/resume sequence determinism
  - Event ordering (flow:paused before status change)
  - Context accumulation across pause boundary

### Gate 4: Integration (Live)
- **Command**: `bun run test:live` (requires subscription auth)
- **Pass Criteria**: End-to-end pause/resume with real Claude agent passes
- **What it validates**:
  - AbortSignal propagation to SDK
  - Multi-turn message handling
  - Real-world latency <100ms (SC-001)

### Gate 5: Documentation
- **Command**: `bun run build` in apps/docs (checks MDX validity)
- **Pass Criteria**: Docs build without errors, all new APIs documented
- **What it validates**:
  - hub.mdx: abort({resumable}), resume(), getAbortSignal() documented
  - flow-runtime.mdx: pause/resume lifecycle documented
  - protocol-types.mdx: SessionState, PauseOptions, events documented
  - No broken links or missing references
