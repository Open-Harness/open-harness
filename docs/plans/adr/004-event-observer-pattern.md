# ADR-004: Event/Observer Pattern

**Status:** Accepted
**Date:** 2026-01-29
**Decision Area:** Event/Observer Pattern
**Related Issues:** ARCH-001, ARCH-005, ARCH-020, NAME-005, NAME-007

---

## Context

The codebase has **fragmented event dispatch** with multiple problems:

### Current Architecture (Problematic)

| Pattern | Location | Purpose |
|---------|----------|---------|
| `WorkflowObserver` | `Engine/types.ts` | Callbacks for SDK users |
| `EventBus` | `Services/EventBus.ts` | PubSub for SSE subscribers |
| `EventStore` | `Services/EventStore.ts` | Persistence for replay |

### Problems Identified

1. **Quadruple dispatch** — Same event goes to 4 places independently:
   - In-memory `Ref<Event[]>`
   - `EventStore.append()`
   - `EventBus.publish()`
   - `dispatchToObserver()` callbacks

2. **Duplicate dispatch code** — `emitEvent()` and the agent execution loop both dispatch to all targets

3. **Type safety lost** — `dispatchToObserver` casts `event.payload as Record<string, unknown>`

4. **Not exhaustive** — Adding a new event type requires updating 3+ places with no compile-time safety

5. **String-based events** — Uses `event.name` instead of Effect's `_tag` convention

6. **Two `Event<N,P>` definitions** — `Domain/Interaction.ts` and `Engine/types.ts`

### Current Event Structure (Non-Idiomatic)

```typescript
// Current: NOT Effect-idiomatic
interface Event<N extends string, P> {
  name: N        // ❌ Should be _tag
  payload: P     // ❌ Should be flat fields
}

// Current dispatch: NOT exhaustive
const dispatchToObserver = (observer, event) => {
  const p = event.payload as Record<string, unknown>  // Type safety GONE
  switch (event.name) {
    case "agent:completed":
      observer.onAgentCompleted?.({
        agent: p.agentName as string,  // Manual translation
        output: p.output,
        durationMs: p.durationMs as number
      })
      break
    // ... 10+ more cases, NOT exhaustive
  }
}
```

---

## Decision

**Use Effect-native PubSub architecture with `Data.TaggedClass`, `Match.exhaustive`, and fiber-based subscribers.**

### Core Principles

1. **Single event emission point** — All events go through one `PubSub`
2. **Independent fiber subscribers** — Store, Bus, Observer run as separate fibers
3. **Effect `_tag` convention** — Events use `Data.TaggedClass` with `_tag` field
4. **Compile-time exhaustiveness** — `Match.exhaustive` catches missing handlers
5. **Failure isolation** — Subscriber failures don't crash the workflow

---

## Event Types (Data.TaggedClass)

Events use Effect's discriminated union pattern with `_tag`:

```typescript
import { Data } from "effect"

// ═══════════════════════════════════════════════════════════════
// Event Classes (13 total)
// ═══════════════════════════════════════════════════════════════

export class WorkflowStarted extends Data.TaggedClass("WorkflowStarted")<{
  readonly sessionId: string
  readonly workflow: string      // Short name per ADR-008
  readonly input: unknown
  readonly timestamp: Date
}> {}

export class WorkflowCompleted extends Data.TaggedClass("WorkflowCompleted")<{
  readonly sessionId: string
  readonly finalState: unknown
  readonly exitPhase?: string
  readonly timestamp: Date
}> {}

export class PhaseEntered extends Data.TaggedClass("PhaseEntered")<{
  readonly phase: string
  readonly fromPhase?: string
  readonly timestamp: Date
}> {}

export class PhaseExited extends Data.TaggedClass("PhaseExited")<{
  readonly phase: string
  readonly reason: "next" | "terminal" | "error"
  readonly timestamp: Date
}> {}

export class AgentStarted extends Data.TaggedClass("AgentStarted")<{
  readonly agent: string         // Short name per ADR-008
  readonly phase?: string
  readonly context?: unknown
  readonly timestamp: Date
}> {}

export class AgentCompleted extends Data.TaggedClass("AgentCompleted")<{
  readonly agent: string         // Short name per ADR-008
  readonly output: unknown
  readonly durationMs: number
  readonly timestamp: Date
}> {}

export class StateUpdated extends Data.TaggedClass("StateUpdated")<{
  readonly state: unknown
  readonly patches?: ReadonlyArray<unknown>
  readonly inversePatches?: ReadonlyArray<unknown>
  readonly timestamp: Date
}> {}

export class TextDelta extends Data.TaggedClass("TextDelta")<{
  readonly agent: string         // Short name per ADR-008
  readonly delta: string
  readonly timestamp: Date
}> {}

export class ThinkingDelta extends Data.TaggedClass("ThinkingDelta")<{
  readonly agent: string         // Short name per ADR-008
  readonly delta: string
  readonly timestamp: Date
}> {}

export class ToolCalled extends Data.TaggedClass("ToolCalled")<{
  readonly agent: string         // Short name per ADR-008
  readonly toolId: string
  readonly toolName: string
  readonly input: unknown
  readonly timestamp: Date
}> {}

export class ToolResult extends Data.TaggedClass("ToolResult")<{
  readonly agent: string         // Short name per ADR-008
  readonly toolId: string
  readonly output: unknown
  readonly isError: boolean
  readonly timestamp: Date
}> {}

export class InputRequested extends Data.TaggedClass("InputRequested")<{
  readonly id: string            // Correlation ID
  readonly prompt: string        // Short name per ADR-008
  readonly type: "approval" | "choice"
  readonly options?: ReadonlyArray<string>
  readonly timestamp: Date
}> {}

export class InputReceived extends Data.TaggedClass("InputReceived")<{
  readonly id: string            // Correlates to request
  readonly value: string
  readonly approved?: boolean
  readonly timestamp: Date
}> {}

// ═══════════════════════════════════════════════════════════════
// Union Type
// ═══════════════════════════════════════════════════════════════

export type WorkflowEvent =
  | WorkflowStarted
  | WorkflowCompleted
  | PhaseEntered
  | PhaseExited
  | AgentStarted
  | AgentCompleted
  | StateUpdated
  | TextDelta
  | ThinkingDelta
  | ToolCalled
  | ToolResult
  | InputRequested
  | InputReceived
```

---

## EventHub Service (PubSub-backed)

Single source of event emission using Effect `PubSub`:

```typescript
import { Context, Effect, PubSub, Scope, Stream } from "effect"

// ═══════════════════════════════════════════════════════════════
// EventHub Service Definition
// ═══════════════════════════════════════════════════════════════

export class EventHub extends Context.Tag("@open-scaffold/EventHub")<
  EventHub,
  {
    /** Publish event to all subscribers */
    readonly publish: (event: WorkflowEvent) => Effect.Effect<void>

    /** Create a subscription (scoped to caller's Scope) */
    readonly subscribe: () => Effect.Effect<
      Stream.Stream<WorkflowEvent>,
      never,
      Scope.Scope
    >
  }
>() {}

// ═══════════════════════════════════════════════════════════════
// EventHub Live Implementation
// ═══════════════════════════════════════════════════════════════

export const makeEventHub = Effect.gen(function*() {
  const pubsub = yield* PubSub.unbounded<WorkflowEvent>()

  return EventHub.of({
    publish: (event) => PubSub.publish(pubsub, event).pipe(Effect.asVoid),

    subscribe: () => Effect.gen(function*() {
      const subscription = yield* PubSub.subscribe(pubsub)
      return Stream.fromQueue(subscription)
    })
  })
})

export const EventHubLive = Layer.scoped(EventHub, makeEventHub)
```

---

## Fiber-Based Subscribers

Each subscriber runs in its own fiber with isolated failure handling:

```typescript
import { Effect, Stream, Match } from "effect"

// ═══════════════════════════════════════════════════════════════
// EventStore Subscriber (persistence)
// ═══════════════════════════════════════════════════════════════

export const makeStoreSubscriber = (sessionId: SessionId) =>
  Effect.gen(function*() {
    const hub = yield* EventHub
    const store = yield* EventStore
    const stream = yield* hub.subscribe()

    yield* stream.pipe(
      Stream.runForEach((event) =>
        store.append(sessionId, toSerializedEvent(event)).pipe(
          // Store failures logged, NOT propagated to workflow
          Effect.catchAll((error) =>
            Effect.logError("EventStore write failed", {
              error,
              event: event._tag,
              sessionId
            })
          )
        )
      )
    )
  })

// ═══════════════════════════════════════════════════════════════
// EventBus Subscriber (SSE broadcast)
// ═══════════════════════════════════════════════════════════════

export const makeBusSubscriber = (sessionId: SessionId) =>
  Effect.gen(function*() {
    const hub = yield* EventHub
    const bus = yield* EventBus
    const stream = yield* hub.subscribe()

    yield* stream.pipe(
      Stream.runForEach((event) =>
        bus.publish(sessionId, toSerializedEvent(event))
      )
    )
  })

// ═══════════════════════════════════════════════════════════════
// Observer Subscriber (user callbacks)
// ═══════════════════════════════════════════════════════════════

export const makeObserverSubscriber = (observer: WorkflowObserver<unknown>) =>
  Effect.gen(function*() {
    const hub = yield* EventHub
    const stream = yield* hub.subscribe()

    yield* stream.pipe(
      Stream.runForEach((event) =>
        Effect.sync(() => dispatchToObserver(observer, event))
      )
    )
  })
```

---

## Exhaustive Observer Dispatch (Match.exhaustive)

Type-safe, compile-time exhaustive dispatch using Effect `Match`:

```typescript
import { Match } from "effect"

// ═══════════════════════════════════════════════════════════════
// Exhaustive Dispatch Function
// ═══════════════════════════════════════════════════════════════

export const dispatchToObserver = (
  observer: WorkflowObserver<unknown>,
  event: WorkflowEvent
): void => {
  // Always call onEvent first
  observer.onEvent?.(toSerializedEvent(event))

  // Exhaustive matching — compile error if any _tag missing!
  Match.value(event).pipe(
    Match.tag("WorkflowStarted", (e) => {
      observer.onStarted?.(e.sessionId)
    }),

    Match.tag("WorkflowCompleted", (e) => {
      // onCompleted called separately with full result
    }),

    Match.tag("PhaseEntered", (e) => {
      observer.onPhaseChanged?.(e.phase, e.fromPhase)
    }),

    Match.tag("PhaseExited", () => {
      // No observer callback for phase exit
    }),

    Match.tag("AgentStarted", (e) => {
      observer.onAgentStarted?.({ agent: e.agent, phase: e.phase })
    }),

    Match.tag("AgentCompleted", (e) => {
      observer.onAgentCompleted?.({
        agent: e.agent,
        output: e.output,
        durationMs: e.durationMs
      })
    }),

    Match.tag("StateUpdated", (e) => {
      observer.onStateChanged?.(e.state, e.patches)
    }),

    Match.tag("TextDelta", (e) => {
      observer.onTextDelta?.({ agent: e.agent, delta: e.delta })
    }),

    Match.tag("ThinkingDelta", (e) => {
      observer.onThinkingDelta?.({ agent: e.agent, delta: e.delta })
    }),

    Match.tag("ToolCalled", (e) => {
      observer.onToolCalled?.({
        agent: e.agent,
        toolId: e.toolId,
        toolName: e.toolName,
        input: e.input
      })
    }),

    Match.tag("ToolResult", (e) => {
      observer.onToolResult?.({
        agent: e.agent,
        toolId: e.toolId,
        output: e.output,
        isError: e.isError
      })
    }),

    Match.tag("InputRequested", (e) => {
      // HITL handled via ADR-002's humanInput handler
    }),

    Match.tag("InputReceived", () => {
      // Internal event, no observer callback
    }),

    Match.exhaustive  // ← Compile error if any event type missing!
  )
}
```

---

## Runtime Wiring

Workflow execution with PubSub and scoped fibers:

```typescript
// ═══════════════════════════════════════════════════════════════
// Workflow Execution with EventHub
// ═══════════════════════════════════════════════════════════════

export const executeWorkflowWithEventHub = <S, Input>(
  workflow: WorkflowDef<S, Input>,
  options: ExecuteOptions<Input>
): Effect.Effect<
  WorkflowResult<S>,
  WorkflowError,
  EventStore | EventBus | ProviderRecorder | ProviderModeContext  // Note: ProviderRegistry removed per ADR-010
> =>
  Effect.scoped(
    Effect.gen(function*() {
      // Create EventHub (scoped to this execution)
      const hub = yield* makeEventHub

      // Fork all subscribers (automatically interrupted when scope closes)
      yield* Effect.forkScoped(makeStoreSubscriber(options.sessionId))
      yield* Effect.forkScoped(makeBusSubscriber(options.sessionId))

      if (options.observer) {
        yield* Effect.forkScoped(makeObserverSubscriber(options.observer))
      }

      // Create emit function (ONE place to emit events!)
      const emit = (event: WorkflowEvent) => hub.publish(event)

      // Track events in memory for result
      const eventsRef = yield* Ref.make<WorkflowEvent[]>([])
      const emitAndTrack = (event: WorkflowEvent) =>
        Effect.gen(function*() {
          yield* Ref.update(eventsRef, (events) => [...events, event])
          yield* emit(event)
        })

      // Run workflow with emit function
      const result = yield* runWorkflowLoop(workflow, options, emitAndTrack)

      // Get all events for result
      const events = yield* Ref.get(eventsRef)

      // Scope closes here → all fibers interrupted → cleanup automatic
      return {
        ...result,
        events: events.map(toSerializedEvent)
      }
    }).pipe(
      Effect.provideService(EventHub, hub)
    )
  )
```

---

## Serialization (JSON Boundary)

Convert tagged events to JSON-friendly format for storage/SSE:

```typescript
// ═══════════════════════════════════════════════════════════════
// Serialization
// ═══════════════════════════════════════════════════════════════

/** JSON-friendly event format for storage and SSE */
export interface SerializedEvent {
  readonly id: EventId
  readonly name: EventName          // "workflow:started", "agent:completed", etc.
  readonly payload: unknown
  readonly timestamp: Date
  readonly causedBy?: EventId
}

/** Map _tag to event name */
const tagToEventName: Record<WorkflowEvent["_tag"], EventName> = {
  WorkflowStarted: "workflow:started",
  WorkflowCompleted: "workflow:completed",
  PhaseEntered: "phase:entered",
  PhaseExited: "phase:exited",
  AgentStarted: "agent:started",
  AgentCompleted: "agent:completed",
  StateUpdated: "state:updated",
  TextDelta: "text:delta",
  ThinkingDelta: "thinking:delta",
  ToolCalled: "tool:called",
  ToolResult: "tool:result",
  InputRequested: "input:requested",
  InputReceived: "input:received",
}

/** Convert WorkflowEvent to SerializedEvent */
export const toSerializedEvent = (event: WorkflowEvent): SerializedEvent => {
  const { _tag, timestamp, ...payload } = event
  return {
    id: makeEventIdSync(),  // Generate ID at serialization
    name: tagToEventName[_tag],
    payload,
    timestamp,
  }
}
```

---

## Observer Interface (Unchanged for DX)

The public `WorkflowObserver` interface remains the same for external consumers:

```typescript
// ═══════════════════════════════════════════════════════════════
// Public Observer Interface (unchanged from before)
// ═══════════════════════════════════════════════════════════════

export interface WorkflowObserver<S> {
  // Lifecycle
  onStarted?(sessionId: string): void
  onCompleted?(result: { state: S; events: ReadonlyArray<SerializedEvent> }): void
  onError?(error: unknown): void  // Renamed per ADR-008

  // State
  onStateChanged?(state: S, patches?: ReadonlyArray<unknown>): void
  onPhaseChanged?(phase: string, from?: string): void

  // Agent lifecycle
  onAgentStarted?(info: { agent: string; phase?: string }): void
  onAgentCompleted?(info: { agent: string; output: unknown; durationMs: number }): void

  // Streaming content
  onTextDelta?(info: { agent: string; delta: string }): void
  onThinkingDelta?(info: { agent: string; delta: string }): void

  // Tool events
  onToolCalled?(info: { agent: string; toolId: string; toolName: string; input: unknown }): void
  onToolResult?(info: { agent: string; toolId: string; output: unknown; isError: boolean }): void

  // Raw catch-all
  onEvent?(event: SerializedEvent): void
}

// Usage — external DX UNCHANGED:
const result = await run(workflow, {
  input: "Hello",
  runtime,
  observer: {
    onTextDelta: ({ delta }) => process.stdout.write(delta),
    onAgentCompleted: ({ agent }) => console.log(`${agent} done`),
  }
})
```

---

## Alternatives Considered

### Option A: Mapped Types (Minimal Change)

Keep string-based `Event<N, P>` but add type map for payload linking.

**Rejected:** Not Effect-idiomatic. No `_tag`, no `Match.exhaustive`, no compile-time safety.

### Option B: Data.TaggedClass + Match (No PubSub)

Use Effect's discriminated unions but keep sequential dispatch.

**Rejected:** Still has multiple dispatch points. Store latency blocks observer callbacks.

### Option D: Hybrid (Fork Store Only)

Use synchronous dispatch with only EventStore in background fiber.

**Rejected:** Doesn't provide full failure isolation or dynamic subscriber capability.

---

## Consequences

### Positive

1. **Compile-time exhaustiveness** — Adding new event type causes compile error until handled
2. **Effect-idiomatic** — Uses `PubSub`, `Stream`, `Data.TaggedClass`, `Match`, `Effect.forkScoped`
3. **Single emission point** — All events through one `PubSub.publish()` call
4. **Failure isolation** — Store failures don't crash workflow
5. **Future-proof** — Works with remote databases (Postgres, Turso, ElectricSQL)
6. **Dynamic subscribers** — Can attach debug loggers, analytics, new SSE clients at runtime
7. **External DX unchanged** — Observer callbacks remain simple `void` functions

### Negative

1. **Breaking change** — Event structure changes from `{name, payload}` to `{_tag, ...fields}`
2. **Serialization layer** — Need `toSerializedEvent()` for storage/SSE
3. **Testing adjustment** — Tests must account for fiber-based processing

### Migration Path

1. Create new `WorkflowEvent` union with `Data.TaggedClass` types
2. Add `EventHub` service with `PubSub` implementation
3. Implement subscriber fibers (store, bus, observer)
4. Update `runtime.ts` to use `EventHub.publish()` instead of direct dispatch
5. Add `Match.exhaustive` dispatch in observer subscriber
6. Add serialization layer for storage/SSE compatibility
7. Remove duplicate dispatch code from `emitEvent()` and agent loop
8. Update tests to use new event types

---

## Implementation Notes

### Files to Create

| File | Purpose |
|------|---------|
| `packages/core/src/Domain/Events.ts` | `Data.TaggedClass` event definitions |
| `packages/core/src/Services/EventHub.ts` | `EventHub` service with `PubSub` |
| `packages/core/src/Engine/subscribers.ts` | Store, Bus, Observer subscribers |
| `packages/core/src/Engine/dispatch.ts` | `Match.exhaustive` dispatch function |

### Files to Modify

| File | Changes |
|------|---------|
| `packages/core/src/Engine/runtime.ts` | Use `EventHub.publish()`, remove direct dispatch |
| `packages/core/src/Engine/types.ts` | Remove old event types, re-export from `Domain/Events.ts` |
| `packages/core/src/Services/EventBus.ts` | Keep for SSE, receives serialized events |
| `packages/core/src/Services/EventStore.ts` | Keep for persistence, receives serialized events |

### Files to Delete

| File | Reason |
|------|--------|
| `packages/core/src/Domain/Interaction.ts` | Duplicate `Event` definition removed per ADR-002 |

### Effect Primitives Used

| Primitive | Purpose |
|-----------|---------|
| `Data.TaggedClass` | Discriminated union events with `_tag` |
| `PubSub.unbounded` | Event broadcasting to subscribers |
| `Stream.fromQueue` | Convert subscription to Stream |
| `Match.value` + `Match.tag` + `Match.exhaustive` | Compile-time exhaustive dispatch |
| `Effect.forkScoped` | Fiber lifecycle tied to workflow scope |
| `Effect.scoped` | Automatic cleanup when workflow ends |
| `Ref` | In-memory event tracking |

---

## Related Files

- `packages/core/src/Engine/types.ts` — Current event types (to be replaced)
- `packages/core/src/Engine/runtime.ts` — Current `emitEvent`, `dispatchToObserver` (to be refactored)
- `packages/core/src/Services/EventBus.ts` — Existing SSE bus
- `packages/core/src/Services/EventStore.ts` — Existing persistence
- `packages/core/src/Domain/Interaction.ts` — Duplicate Event definition (to be deleted)

---

## References

- [Effect Pattern Matching](https://effect.website/docs/code-style/pattern-matching/)
- [Effect PubSub](https://effect.website/docs/concurrency/pubsub/)
- [Effect Data.TaggedClass](https://effect-ts.github.io/effect/effect/Data.ts.html)
- [ADR-002: HITL Architecture](./002-hitl-architecture.md)
- [ADR-008: Naming Conventions](./008-naming-conventions.md)
