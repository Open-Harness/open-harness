/**
 * Fiber-based event subscribers for EventHub.
 *
 * Per ADR-004: Each subscriber runs in its own fiber with isolated failure handling.
 * Subscribers:
 * - makeStoreSubscriber: Persists events to EventStore
 * - makeBusSubscriber: Broadcasts events to EventBus (SSE)
 * - makeObserverSubscriber: Dispatches to user-provided observer callbacks
 *
 * All subscribers use Effect.forkScoped for automatic cleanup when the
 * workflow scope closes.
 *
 * @module
 */

import { Effect, Stream } from "effect"

import type { WorkflowEvent, WorkflowEventTag } from "../Domain/Events.js"
import type { SessionId } from "../Domain/Ids.js"
import { EventBus } from "../Services/EventBus.js"
import { EventHub } from "../Services/EventHub.js"
import { EventStore } from "../Services/EventStore.js"
import { dispatchToObserver } from "./dispatch.js"
import type { AnyEvent, EventId, EventName, WorkflowObserver } from "./types.js"

// ─────────────────────────────────────────────────────────────────
// Event Serialization (local until task 1.5 adds shared layer)
// ─────────────────────────────────────────────────────────────────

/**
 * Map from Data.TaggedClass _tag to serialized event name.
 * Per ADR-004: Convert internal _tag to external event names like "workflow:started".
 */
const tagToEventName: Record<WorkflowEventTag, EventName> = {
  WorkflowStarted: "workflow:started",
  WorkflowCompleted: "workflow:completed",
  PhaseEntered: "phase:entered",
  PhaseExited: "phase:exited",
  AgentStarted: "agent:started",
  AgentCompleted: "agent:completed",
  StateIntent: "state:updated",
  StateCheckpoint: "state:updated",
  SessionForked: "workflow:started", // Maps to workflow event for now
  TextDelta: "text:delta",
  ThinkingDelta: "thinking:delta",
  ToolCalled: "tool:called",
  ToolResult: "tool:result",
  InputRequested: "input:requested",
  InputReceived: "input:response"
}

/**
 * Convert WorkflowEvent (Data.TaggedClass) to AnyEvent (serialized format).
 * Per ADR-004: Serialization layer for storage and SSE.
 */
const toSerializedEvent = (event: WorkflowEvent): AnyEvent => {
  const { _tag, timestamp, ...payload } = event
  return {
    id: crypto.randomUUID() as EventId,
    name: tagToEventName[_tag],
    payload,
    timestamp
  }
}

// ─────────────────────────────────────────────────────────────────
// Store Subscriber (EventStore persistence)
// ─────────────────────────────────────────────────────────────────

/**
 * Create a fiber that persists events to EventStore.
 *
 * Per ADR-004:
 * - Subscribes to EventHub
 * - For each event, serializes and appends to EventStore
 * - Store failures are logged but NOT propagated (failure isolation)
 * - Uses Effect.forkScoped for automatic cleanup
 *
 * @param sessionId - Session ID for event storage
 * @returns Effect that forks the subscriber fiber
 *
 * @example
 * ```typescript
 * yield* Effect.forkScoped(makeStoreSubscriber(sessionId))
 * ```
 */
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
      ),
      Effect.forkScoped
    )
  })

// ─────────────────────────────────────────────────────────────────
// Bus Subscriber (EventBus SSE broadcast)
// ─────────────────────────────────────────────────────────────────

/**
 * Create a fiber that broadcasts events to EventBus.
 *
 * Per ADR-004:
 * - Subscribes to EventHub
 * - For each event, serializes and publishes to EventBus (SSE clients)
 * - Uses Effect.forkScoped for automatic cleanup
 *
 * @param sessionId - Session ID for SSE channel
 * @returns Effect that forks the subscriber fiber
 *
 * @example
 * ```typescript
 * yield* Effect.forkScoped(makeBusSubscriber(sessionId))
 * ```
 */
export const makeBusSubscriber = (sessionId: SessionId) =>
  Effect.gen(function*() {
    const hub = yield* EventHub
    const bus = yield* EventBus
    const stream = yield* hub.subscribe()

    yield* stream.pipe(
      Stream.runForEach((event) => bus.publish(sessionId, toSerializedEvent(event))),
      Effect.forkScoped
    )
  })

// ─────────────────────────────────────────────────────────────────
// Observer Subscriber (user callbacks)
// ─────────────────────────────────────────────────────────────────

/**
 * Create a fiber that dispatches events to user-provided observer callbacks.
 *
 * Per ADR-004:
 * - Subscribes to EventHub
 * - For each event, calls dispatchToObserver (Match.exhaustive dispatch)
 * - Uses Effect.forkScoped for automatic cleanup
 *
 * @param observer - User-provided observer with optional callbacks
 * @returns Effect that forks the subscriber fiber
 *
 * @example
 * ```typescript
 * if (options.observer) {
 *   yield* Effect.forkScoped(makeObserverSubscriber(options.observer))
 * }
 * ```
 */
export const makeObserverSubscriber = (observer: WorkflowObserver<unknown>) =>
  Effect.gen(function*() {
    const hub = yield* EventHub
    const stream = yield* hub.subscribe()

    yield* stream.pipe(
      Stream.runForEach((event) => Effect.sync(() => dispatchToObserver(observer, event))),
      Effect.forkScoped
    )
  })
