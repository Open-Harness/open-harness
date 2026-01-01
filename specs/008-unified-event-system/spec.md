# Feature Specification: Unified Event System

**Feature Branch**: `008-unified-event-system`
**Created**: 2025-12-27
**Status**: Draft
**Depends On**: 007-fluent-harness-dx (must complete first)
**Input**: User feedback: "Agent events and harness events are two separate systems. A renderer that wants to show 'agent is thinking while executing task X' can't correlate events."

## Overview

The current system has two parallel event mechanisms that don't communicate:
1. **AgentEvent** (SDK level) — tool calls, thinking, text tokens from Claude SDK
2. **HarnessEvent** (workflow level) — phases, tasks, narratives from harness execution

This creates a fundamental DX problem: renderers can't show "agent is thinking" alongside "running task T003" because `AgentEvent` has no task context and `HarnessEvent` has no agent-level detail.

This feature unifies both systems into a single `UnifiedEventBus` with automatic context propagation via Node.js `AsyncLocalStorage`. Events automatically inherit contextual information (session, phase, task, agent) without explicit passing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Context Propagation (Priority: P1)

As a workflow author, I want agent events to automatically include task context so that renderers can correlate low-level agent activity with high-level workflow structure.

**Why this priority**: This is the core problem statement. If agent events don't automatically get task context, the feature provides no value.

**Independent Test**: Create a harness with a task that calls an agent. Capture all emitted events. Verify that `agent:tool:start` events include the task ID in their context without any explicit passing.

**Acceptance Scenarios**:

1. **Given** an agent executing within a task scope, **When** the agent emits tool events, **Then** each event's context includes `{ task: { id: 'T003' } }`.
2. **Given** nested scopes (session > phase > task), **When** any event is emitted, **Then** all parent context is automatically attached.
3. **Given** agent code that calls `emit()` with no context argument, **When** the event is delivered, **Then** it has the full inherited context from the call stack.

---

### User Story 2 - Parallel Execution Safety (Priority: P1)

As a workflow author running tasks in parallel, I want each parallel branch to maintain its own context so that events from concurrent agents are correctly attributed.

**Why this priority**: Parallel execution is common (e.g., running 3 agents simultaneously). Context corruption would make the system useless for real workflows.

**Independent Test**: Run 3 tasks in parallel via `Promise.all()`. Each task runs an agent that emits events. Verify each agent's events have the correct task ID, not cross-contaminated.

**Acceptance Scenarios**:

1. **Given** `Promise.all([task('T1', fn1), task('T2', fn2), task('T3', fn3)])`, **When** agents emit events concurrently, **Then** each event has the correct task ID.
2. **Given** parallel branches with different phase contexts, **When** events are emitted, **Then** each event reflects its own branch's context.
3. **Given** a mix of sync and async operations in parallel, **When** context is checked at any point, **Then** it reflects the correct scope.

---

### User Story 3 - Unified Subscription API (Priority: P1)

As a renderer author, I want to subscribe to all event types through a single API so that I don't need to manage multiple event sources.

**Why this priority**: If renderers still need to subscribe to two separate systems, the unification provides no practical benefit.

**Independent Test**: Create a renderer that subscribes to `*` on the unified bus. Run a harness that emits both harness events and agent events. Verify all events arrive through the single subscription.

**Acceptance Scenarios**:

1. **Given** a single `bus.subscribe('*', handler)` call, **When** harness emits `phase:start` and agent emits `agent:tool:start`, **Then** both events arrive at the handler.
2. **Given** a subscription with type filter `['task:*', 'agent:*']`, **When** a `phase:start` event is emitted, **Then** it is NOT delivered to the handler.
3. **Given** multiple subscribers, **When** an event is emitted, **Then** all matching subscribers receive it.

---

### User Story 4 - Declarative Renderer API (Priority: P1)

As a renderer author, I want a declarative `defineRenderer()` API so that I can build type-safe renderers with minimal boilerplate.

**Why this priority**: Without a clean renderer API, the unified bus is just infrastructure with no DX improvement.

**Independent Test**: Use `defineRenderer()` to create a minimal renderer. Wire it to a harness. Verify event handlers receive typed events and can update state.

**Acceptance Scenarios**:

1. **Given** a renderer defined with `defineRenderer({ on: { 'task:start': handler } })`, **When** a `task:start` event occurs, **Then** the handler is called with a typed `TaskEvent`.
2. **Given** renderer state defined as `state: () => ({ count: 0 })`, **When** handlers modify state, **Then** state changes persist across events.
3. **Given** `onStart` and `onComplete` lifecycle hooks, **When** the harness runs, **Then** hooks are called at the correct times.

---

### User Story 5 - Backward Compatibility (Priority: P1)

As a developer with existing harnesses, I want `harness.on()` to continue working so that I don't have to migrate all code at once.

**Why this priority**: Breaking existing code would block adoption.

**Independent Test**: Run existing harnesses unchanged. Verify `.on('task', handler)` callbacks still receive events as before.

**Acceptance Scenarios**:

1. **Given** existing code using `harness.on('narrative', handler)`, **When** upgrading SDK version, **Then** code compiles and runs without changes.
2. **Given** a harness using the old API, **When** it runs alongside code using the new unified bus, **Then** both work correctly.
3. **Given** the SDK exports, **When** I check exports, **Then** both legacy and new APIs are exported.

---

### User Story 6 - EnrichedEvent Wrapper (Priority: P2)

As a renderer author, I want all events wrapped in an `EnrichedEvent` envelope so that I have consistent metadata (id, timestamp, context) for every event type.

**Why this priority**: Consistent envelope enables generic event handling (logging, replay, debugging).

**Independent Test**: Subscribe to events and verify each received event has `id`, `timestamp`, `context`, and `event` properties regardless of event type.

**Acceptance Scenarios**:

1. **Given** any event emitted through the bus, **When** a subscriber receives it, **Then** it has shape `{ id: string, timestamp: Date, context: EventContext, event: BaseEvent }`.
2. **Given** an event with auto-generated ID, **When** I inspect the ID, **Then** it's a valid UUID.
3. **Given** an event with override context, **When** I inspect context, **Then** it merges override with inherited context (override wins on conflicts).

---

### User Story 7 - Scoped Context Helper (Priority: P2)

As a workflow author, I want a `scoped(ctx, fn)` helper so that I can create custom context scopes beyond the built-in phase/task helpers.

**Why this priority**: Custom scopes enable advanced patterns (validation runs, retry loops, sub-workflows).

**Independent Test**: Use `bus.scoped({ custom: 'value' }, async () => ...)` and verify events emitted inside the scope include the custom context.

**Acceptance Scenarios**:

1. **Given** `bus.scoped({ agent: { name: 'MyAgent' } }, fn)`, **When** events are emitted inside `fn`, **Then** they include `agent: { name: 'MyAgent' }` in context.
2. **Given** nested scopes, **When** inner scope overrides a field, **Then** events in inner scope use the override.
3. **Given** a scope that throws, **When** execution exits the scope, **Then** context reverts to parent scope.

---

### Edge Cases

- **Empty context**: When no scope is active:
  - **Behavior**: `context` contains only `{ sessionId: string }` from bus creation
  - **Test**: Emit event at top level, assert minimal context

- **Listener throws**: When an event listener throws:
  - **Behavior**: Log error to console.error, continue delivering to other listeners, do NOT re-throw
  - **Rationale**: Observer pattern — listeners should not crash the emitter
  - **Log format**: `[UnifiedEventBus] Listener error: ${error.message}`
  - **Test**: Add throwing listener, verify other listeners still receive event

- **Emit after bus cleared**: When `bus.clear()` is called:
  - **Behavior**: `emit()` succeeds but no listeners receive the event (no-op delivery)
  - **Test**: Clear bus, emit event, verify no errors

- **Subscribe with invalid filter**: When filter references non-existent event type:
  - **Behavior**: Subscription succeeds but never matches (future-proof for new event types)
  - **Test**: Subscribe to `['unknown:type']`, emit real events, verify handler never called

- **AsyncLocalStorage unavailable**: In edge runtime without async_hooks:
  - **Behavior**: Throw clear error at bus construction: `UnifiedEventBus requires Node.js/Bun runtime with AsyncLocalStorage support`
  - **Rationale**: Fail fast rather than silently lose context
  - **Test**: Mock AsyncLocalStorage as undefined, verify constructor throws

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `UnifiedEventBus` class that:
  - (a) Uses Node.js `AsyncLocalStorage` for context propagation
  - (b) Provides `scoped<T>(ctx, fn): T | Promise<T>` that wraps work with context that survives async boundaries
  - (c) Provides `emit(event, override?)` that auto-attaches current context from AsyncLocalStorage
  - (d) Provides `subscribe(filter?, listener): unsubscribe` for filtered event subscription
  - (e) Provides `current(): EventContext` for inspecting active context

- **FR-002**: System MUST define `EnrichedEvent<T>` wrapper type with:
  - (a) `id: string` — unique event identifier (UUID)
  - (b) `timestamp: Date` — when event was emitted
  - (c) `context: EventContext` — inherited + override context
  - (d) `event: T` — the original event payload

- **FR-003**: System MUST define `EventContext` type with:
  - (a) `sessionId: string` — required, set at bus creation
  - (b) `phase?: { name: string; number?: number }` — optional phase scope
  - (c) `task?: { id: string; description?: string }` — optional task scope
  - (d) `agent?: { name: string; type?: string }` — optional agent scope

- **FR-004**: System MUST define `BaseEvent` union type that includes:
  - (a) Workflow events: `harness:start`, `harness:complete`, `phase:start`, `phase:complete`, `task:start`, `task:complete`, `task:failed`
  - (b) Agent events: `agent:start`, `agent:thinking`, `agent:text`, `agent:tool:start`, `agent:tool:complete`, `agent:complete`
  - (c) Narrative event: `narrative` with text and importance
  - (d) Session events: `session:prompt`, `session:reply`, `session:abort` (for future interactive-sessions)
  - (e) Extensible via `{ type: string; [key: string]: unknown }`

- **FR-005**: System MUST provide `defineRenderer<TState>(def): IUnifiedRenderer` factory that:
  - (a) Accepts `name`, `state` factory, `on` event handlers, `onStart`, `onComplete` hooks
  - (b) Provides typed `RenderContext<TState>` with `state`, `event`, `emit`, `config`
  - (c) Provides `RenderOutput` with `line()`, `update()`, `spinner()`, `progress()`, `clear()`, `newline()`

- **FR-006**: System MUST integrate with existing harness infrastructure:
  - (a) `HarnessInstance.on()` delegates to unified bus subscription
  - (b) `phase()` and `task()` helpers create scoped contexts via bus
  - (c) Agents receive `eventBus` via DI and emit with auto-context

- **FR-007**: System MUST maintain backward compatibility:
  - (a) Existing `harness.on()` patterns continue working
  - (b) Existing renderers can be wrapped via adapter
  - (c) No breaking changes to current public APIs

### Key Entities

- **UnifiedEventBus**: Central event infrastructure with AsyncLocalStorage context propagation.
- **EnrichedEvent<T>**: Envelope wrapping any event with id, timestamp, and context.
- **EventContext**: Contextual metadata (session, phase, task, agent) attached to events.
- **BaseEvent**: Union of all known event types (workflow + agent + narrative + session).
- **IUnifiedRenderer**: Interface for renderers consuming unified events.
- **RendererDefinition<TState>**: Configuration object for `defineRenderer()`.
- **RenderContext<TState>**: Object passed to event handlers with state, event, and output helpers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Agent tool events automatically include task context.
  - **Measurement**: In a harness task, agent emits `agent:tool:start`. Captured event has `context.task.id` set.
  - **Verification task**: T015 runs harness, filters events, asserts context presence on all agent events.

- **SC-002**: Parallel agent execution maintains correct context per branch.
  - **Measurement**: Run 3 parallel tasks, each emitting 5 events. All 15 events have correct task IDs (0 misattributions).
  - **Verification task**: T020 runs parallel test, asserts `event.context.task.id === expected` for each.

- **SC-003**: `defineRenderer()` works with full type inference.
  - **Measurement**: `tsc --noEmit` passes with strict mode on test renderer code. Hover on event in handler shows correct type.
  - **Verification task**: T025 adds type test file with `expectType<>()` assertions.

- **SC-004**: No breaking changes to existing harness.on() API.
  - **Measurement**: All tests in `tests/harness/` pass without modification to test code.
  - **Verification task**: T030 runs existing test suite, asserts 0 failures.

- **SC-005**: Single subscription receives all event types.
  - **Measurement**: Subscribe to `*`, run harness that emits 5 harness events and 10 agent events. Receive exactly 15 events.
  - **Verification task**: T035 counts events by type, asserts total matches expected.

- **SC-006**: Unit tests for UnifiedEventBus achieve **≥90% line coverage**.
  - **Measurement**: `bun test --coverage` reports ≥90% for `unified-event-bus.ts`.
  - **Verification task**: T040 runs coverage check.

- **SC-007**: **Ultimate Test** — Console renderer shows agent activity with task context.
  - **Measurement**: Run a multi-task harness with console renderer. Output includes lines like:
    - `[T003] Agent thinking: "I should use the read tool..."`
    - `[T003] Tool call: read_file`
  - **Verification task**: T045 captures console output, regex matches `\[T\d+\].*Tool call`.

## Assumptions

- Node.js `AsyncLocalStorage` (or Bun equivalent) provides correct context isolation across Promise.all branches.
- The ~5-10% performance overhead of AsyncLocalStorage is acceptable for this use case.
- Agents can be modified to receive `eventBus` via DI and call `emit()` instead of direct callbacks.
- The existing `IEventBus` interface can be extended rather than replaced.

## Non-Goals

- This feature does NOT add new agent capabilities.
- This feature does NOT provide browser support (AsyncLocalStorage is Node.js/Bun only).
- This feature does NOT implement event persistence or replay (separate concern).
- This feature does NOT add backpressure handling (events are fire-and-forget).
- This feature does NOT guarantee strict event ordering (best-effort delivery).

## Migration Path

1. **Phase 1**: Add UnifiedEventBus alongside existing EventBus (both active).
2. **Phase 2**: Migrate agents to emit through UnifiedEventBus.
3. **Phase 3**: Update harness to use UnifiedEventBus internally.
4. **Phase 4**: Add defineRenderer() API.
5. **Phase 5**: Deprecate old EventBus (provide migration guide).

## Open Questions

1. **Event ordering**: Should events be guaranteed in-order or best-effort?
   - **Recommendation**: Best-effort. Strict ordering adds complexity for minimal benefit.

2. **Backpressure**: What happens if renderer is slow and events queue up?
   - **Recommendation**: Fire-and-forget. Slow listeners don't block emission.

3. **Replay integration**: How does unified stream affect recording/replay?
   - **Recommendation**: Defer to separate feature. Record EnrichedEvents, replay via bus.

4. **Server-side filtering**: Should bus filter before delivery or let clients filter?
   - **Recommendation**: Server-side for efficiency. Filter in `subscribe()`, not in handler.
