# PRD: Effect Workflow System (core-v2)

## Problem Statement

Open Harness needs a **complete rewrite** of its core architecture to achieve three goals:

### Goal A: Time-Travel Debugging (THE killer feature)

Developers debugging AI agent workflows need to step **backward** through execution history, not just forward. When a workflow fails at 3am, the developer should be able to:
- Load the recorded session
- Step backward event by event to find exactly where things went wrong
- Jump to any point in history and inspect state
- All without re-running anything or burning API credits

**This is non-negotiable**. Time-travel debugging via `tape.stepBack()` is what makes Open Harness fundamentally better than console.log debugging.

### Goal B: Effect-TS Under the Hood

The internal implementation should use Effect TypeScript library for:
- Managed async operations
- Typed error channels
- Resource safety (connections cleaned up on abort/error)
- Structured concurrency

But consumers see **zero Effect types**. They get Promises, plain objects, and familiar async/await patterns.

### Goal C: Event-Sourced Architecture

Everything is an immutable event. State is derived by replaying handlers over the event log. This enables:
- Deterministic replay (same events = same state, every time)
- Recording and playback without API calls
- Time-travel by recomputing state at any position

## Solution

Build a **greenfield package** (`packages/core-v2`) with:

1. **Event primitives**: Immutable events with `id`, `name`, `payload`, `timestamp`, `causedBy`
2. **Pure handlers**: `(Event, State) → { state, events[] }` - deterministic, no side effects
3. **Tape interface**: VCR-style controls (`rewind`, `step`, `stepBack`, `stepTo`, `play`, `pause`)
4. **Effect Services**: LLMProvider, Store, EventBus, HandlerRegistry, AgentRegistry, WorkflowRuntime
5. **Clean public API**: Zero Effect types exposed - ManagedRuntime at boundary
6. **React integration**: `useWorkflow` hook with AI SDK compatibility

## Success Criteria

1. **SC-001**: `tape.stepBack()` works - developers can step backward through any recorded session
2. **SC-002**: Zero Effect types in public API exports (verified by TypeScript)
3. **SC-003**: 100% of internal async operations use Effect
4. **SC-004**: Replay produces identical state 100x in a row
5. **SC-005**: React developers can build chat UI using only public types
6. **SC-006**: Recording works - events persist to Store, replay without API calls

## User Stories

### US1: Time-Travel Debugging (Priority: P1) - MVP

A developer loads a recorded session and steps backward through execution to debug.

**Acceptance**:
- `tape.stepBack()` correctly reverts state to previous position
- `tape.stepTo(n)` jumps to any position with correct state
- Position, current event, and state are always consistent

### US2: Event-Driven Workflow (Priority: P2)

A developer defines events, handlers, and agents. Events flow through the system with state updates.

**Acceptance**:
- Events route to matching handlers
- Handlers return new state + new events
- Agents activate when `activatesOn` matches
- Workflow terminates when `until(state)` is true

### US3: Recording & Replay (Priority: P3)

A developer records a session, then replays without API calls.

**Acceptance**:
- `record: true` persists all events to Store
- `workflow.load(sessionId)` returns Tape with recorded events
- `tape.play()` replays without network calls
- Same session replayed 100x produces identical state

### US4: Event Rendering (Priority: P4)

A developer creates renderers for terminal, web, and logs.

**Acceptance**:
- Renderers receive events without affecting state
- Pattern matching works (`error:*`, `text:delta`)
- Multiple renderers can observe the same event stream

### US5: Clean Public API (Priority: P5)

A developer uses the library without Effect knowledge.

**Acceptance**:
- No Effect types in public exports
- `workflow.run()` returns Promise
- Errors are standard Error objects

### US6: React Integration (Priority: P6)

A frontend developer uses `useWorkflow` hook with AI SDK-compatible API.

**Acceptance**:
- Hook returns `messages`, `input`, `setInput`, `handleSubmit`, `isLoading`, `error`
- Also returns `events`, `state`, `tape` for power users
- Tape controls work from React

## Architecture

### Project Structure

```text
packages/core-v2/
├── src/
│   ├── index.ts                    # Public API (Effect-free)
│   ├── react.ts                    # React subpath export
│   ├── event/                      # Event primitives
│   ├── handler/                    # Pure handler system
│   ├── agent/                      # AI agent abstraction
│   ├── workflow/                   # Workflow orchestration
│   ├── tape/                       # Time-travel VCR
│   ├── store/                      # Persistence layer
│   ├── renderer/                   # Event rendering
│   ├── provider/                   # LLM providers
│   ├── message/                    # Message projection
│   └── internal/                   # Effect utilities
└── tests/
```

### Effect Layer Architecture

```
                    ┌─────────────────────────────────────────┐
                    │           WorkflowRuntimeLive           │
                    │   (orchestrates the event loop)         │
                    └───────────────┬─────────────────────────┘
                                    │ depends on
          ┌─────────────────────────┼─────────────────────────┐
          │              │          │          │              │
          ▼              ▼          ▼          ▼              ▼
   ┌──────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │LLMProvider│  │  Store   │ │ EventBus │ │ Handler  │ │  Agent   │
   │  Live    │  │  Live    │ │  Live    │ │ Registry │ │ Registry │
   └────┬─────┘  └────┬─────┘ └──────────┘ └──────────┘ └──────────┘
        │             │
        │             ├── MemoryStoreLive (default)
        │             └── SqliteStoreLive (production)
        │
        └── ClaudeProviderLive (default)
```

### Key Entities

- **Event**: Immutable fact with `id`, `name`, `payload`, `timestamp`, `causedBy`
- **State**: Plain object computed by applying handlers to event log
- **Handler**: Pure function `(event, state) → { state, events[] }`
- **Agent**: AI actor with `name`, `activatesOn`, `emits`, `prompt`, `outputSchema` (required)
- **Tape**: VCR controls + inspection (`position`, `current`, `events`, `state`)
- **Store**: Persistence with `append`, `events`, `sessions`, `clear`
- **Workflow**: Container combining `state`, `handlers`, `agents`, `until`, `store`

## Technical Requirements

### Phase 1: Setup

- **TR-001**: Create `packages/core-v2/` directory structure
- **TR-002**: Initialize package.json with dependencies
- **TR-003**: Configure tsconfig.json with strict mode
- **TR-004**: Configure vitest with @effect/vitest
- **TR-005**: Create public API entry point (Effect-free)
- **TR-006**: Create React subpath export stub
- **TR-007**: Create Effect→Promise boundary utilities
- **TR-008**: Create Zod→JSON Schema conversion utility

### Phase 2: Foundational (BLOCKS all user stories)

- **TR-009**: Create Event type with @effect/schema
- **TR-010**: Create Handler type and registry
- **TR-011**: Create Agent interface
- **TR-012**: Create Effect Service Tags (Store, LLMProvider, EventBus, HandlerRegistry, AgentRegistry)
- **TR-013**: Create built-in event schemas (UserInput, TextDelta, TextComplete, AgentStarted, etc.)
- **TR-014**: Create append-only EventLog

### Phase 3: User Story 1 - Time-Travel (MVP)

- **TR-015**: Create Tape interface with position, length, current, state, events
- **TR-016**: Implement `rewind()` - return to position 0
- **TR-017**: Implement `step()` - advance one event forward
- **TR-018**: Implement `stepBack()` - THE KEY FEATURE - go backward one event
- **TR-019**: Implement `stepTo(n)` - jump to any position
- **TR-020**: Implement state recomputation via handler replay

### Phase 4: User Story 2 - Event-Driven Workflow

- **TR-021**: Create WorkflowRuntime with event loop
- **TR-022**: Implement event routing to handlers
- **TR-023**: Implement agent activation on matching events
- **TR-024**: Implement termination condition check
- **TR-025**: Create Workflow factory and public API
- **TR-026**: Create Layer composition and ManagedRuntime

### Phase 5: User Story 3 - Recording & Replay

- **TR-027**: Create MemoryStore Layer
- **TR-028**: Create SqliteStore Layer
- **TR-029**: Implement recording logic in WorkflowRuntime
- **TR-030**: Implement `workflow.load(sessionId)` returning Tape
- **TR-031**: Implement `play()`, `playTo(n)`, `pause()` on Tape
- **TR-032**: Ensure replay makes NO LLM calls

### Phase 6: User Story 4 - Renderers

- **TR-033**: Create Renderer interface
- **TR-034**: Implement pattern matching for event names
- **TR-035**: Integrate renderers into WorkflowRuntime

### Phase 7: User Story 5 - Clean API

- **TR-036**: Audit exports for zero Effect leakage
- **TR-037**: Implement Error conversion at boundary
- **TR-038**: Add factory function DX (defineEvent, defineHandler, agent)

### Phase 8: User Story 6 - React Integration

- **TR-039**: Create Message type for AI SDK compatibility
- **TR-040**: Implement event→message projection
- **TR-041**: Create `useWorkflow` hook
- **TR-042**: Create WorkflowProvider context

### Phase 9: LLM Provider

- **TR-043**: Create ClaudeProvider Layer
- **TR-044**: Implement streaming via Effect Stream
- **TR-045**: Implement structured output (Zod→JSON Schema→SDK)

### Phase 10: Polish

- **TR-046**: Handle all edge cases (stepBack at 0, step past end, etc.)
- **TR-047**: Server integration (createWorkflowHandler)
- **TR-048**: Final validation (quickstart examples, deterministic replay)

## Verification

### V-01: Type check passes
```bash
bun run typecheck  # Zero errors across monorepo
```

### V-02: Lint passes
```bash
bun run lint  # Zero lint errors
```

### V-03: Tests pass
```bash
bun run test  # All tests pass
```

### V-04: Time-travel works
```typescript
const tape = await workflow.load(sessionId);
tape.stepTo(15);
const state15 = tape.state;
tape.stepBack();  // Now at 14
tape.stepBack();  // Now at 13
expect(tape.position).toBe(13);
```

### V-05: Zero Effect leakage
```bash
# TypeScript should compile consumer code with NO Effect imports
tsc --noEmit examples/consumer-app.ts
```

### V-06: Deterministic replay
```typescript
for (let i = 0; i < 100; i++) {
  const tape = await workflow.load(sessionId);
  tape.playTo(10);
  expect(tape.state).toEqual(expectedState);  // Identical every time
}
```

## Out of Scope

- Refactoring existing `@internal/*` packages
- Migration path from old architecture
- Web/SSE adapters (future iteration)
- Ink-based rich TUI (future iteration)

## Dependencies

- effect (latest stable)
- @effect/schema
- @effect/platform
- @anthropic-ai/claude-agent-sdk
- zod (for public API schemas)
- zod-to-json-schema

## Reference

Original design documents:
- `specs/001-effect-refactor/spec.md` - Full specification with requirements
- `specs/001-effect-refactor/plan.md` - Technical plan with Effect architecture
- `specs/001-effect-refactor/tasks.md` - Detailed task breakdown
- `specs/001-effect-refactor/contracts/` - TypeScript interface contracts
- `specs/001-effect-refactor/data-model.md` - Entity definitions
- `specs/001-effect-refactor/quickstart.md` - Usage examples
