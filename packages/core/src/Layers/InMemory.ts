/**
 * In-memory implementations of EventStore, EventBus, and ProviderRecorder.
 *
 * Real implementations using in-memory data structures.
 * Suitable for standalone/testing use without external dependencies.
 *
 * - InMemoryEventStore: Uses a Map<string, AnyEvent[]> for storage
 * - InMemoryEventBus: Noop publish, empty subscribe (no subscribers in standalone mode)
 * - InMemoryProviderRecorder: Uses a Map for recording/playback storage
 *
 * @module
 */

import { Effect, Layer, Ref, Stream } from "effect"

import type { SessionId } from "../Domain/Ids.js"
import type { AgentStreamEvent } from "../Domain/Provider.js"
import type { AnyEvent } from "../Engine/types.js"
import { EventBus } from "../Services/EventBus.js"
import { EventStore } from "../Services/EventStore.js"
import {
  ProviderRecorder,
  type ProviderRecorderService,
  type RecordingEntry,
  type RecordingEntryMeta
} from "../Services/ProviderRecorder.js"

// ─────────────────────────────────────────────────────────────────
// InMemoryEventStore
// ─────────────────────────────────────────────────────────────────

/**
 * In-memory EventStore implementation.
 *
 * Stores events in a `Map<string, AnyEvent[]>` managed by an Effect Ref.
 * All operations are real — append stores, getEvents retrieves, etc.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const store = yield* EventStore
 *   yield* store.append(sessionId, event)
 *   const events = yield* store.getEvents(sessionId)
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(InMemoryEventStore)))
 * ```
 */
export const InMemoryEventStore: Layer.Layer<EventStore> = Layer.effect(
  EventStore,
  Effect.gen(function*() {
    const ref = yield* Ref.make(new Map<string, Array<AnyEvent>>())

    return EventStore.of({
      append: (sessionId: SessionId, event: AnyEvent) =>
        Ref.update(ref, (store) => {
          const next = new Map(store)
          const events = next.get(sessionId) ?? []
          next.set(sessionId, [...events, event])
          return next
        }),

      getEvents: (sessionId: SessionId) =>
        Ref.get(ref).pipe(
          Effect.map((store) => store.get(sessionId) ?? [])
        ),

      getEventsFrom: (sessionId: SessionId, position: number) =>
        Ref.get(ref).pipe(
          Effect.map((store) => {
            const events = store.get(sessionId) ?? []
            return events.slice(position)
          })
        ),

      listSessions: () =>
        Ref.get(ref).pipe(
          Effect.map((store) => Array.from(store.keys()) as Array<SessionId>)
        ),

      deleteSession: (sessionId: SessionId) =>
        Ref.update(ref, (store) => {
          const next = new Map(store)
          next.delete(sessionId)
          return next
        })
    })
  })
)

// ─────────────────────────────────────────────────────────────────
// InMemoryEventBus
// ─────────────────────────────────────────────────────────────────

/**
 * In-memory EventBus implementation (standalone/noop mode).
 *
 * - publish: succeeds immediately (noop — no subscribers in standalone mode)
 * - subscribe: returns an empty stream (completes immediately)
 *
 * This satisfies the EventBus service contract for standalone execution
 * where no live subscribers (SSE clients) are expected.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const bus = yield* EventBus
 *   yield* bus.publish(sessionId, event) // succeeds, noop
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(InMemoryEventBus)))
 * ```
 */
export const InMemoryEventBus: Layer.Layer<EventBus> = Layer.succeed(
  EventBus,
  EventBus.of({
    publish: () => Effect.void,
    subscribe: () => Stream.empty
  })
)

// ─────────────────────────────────────────────────────────────────
// InMemoryProviderRecorder
// ─────────────────────────────────────────────────────────────────

/**
 * Internal state for an in-progress incremental recording.
 */
interface InProgressRecording {
  readonly hash: string
  readonly prompt: string
  readonly provider: string
  readonly events: Array<AgentStreamEvent>
}

/**
 * Create an in-memory ProviderRecorderService instance.
 *
 * This is a real implementation that stores recordings in a Map.
 * Useful for testing with recorded fixtures without needing LibSQL.
 *
 * @returns A ProviderRecorderService backed by in-memory storage
 */
export const makeInMemoryProviderRecorder = (): ProviderRecorderService => {
  const recordings = new Map<string, RecordingEntry>()
  const inProgress = new Map<string, InProgressRecording>()
  let nextId = 0

  return {
    load: (hash: string) => Effect.succeed(recordings.get(hash) ?? null),

    save: (entry) =>
      Effect.sync(() => {
        recordings.set(entry.hash, { ...entry, recordedAt: new Date() })
      }),

    delete: (hash: string) =>
      Effect.sync(() => {
        recordings.delete(hash)
      }),

    list: () =>
      Effect.sync(() => {
        const entries: Array<RecordingEntryMeta> = []
        for (const entry of recordings.values()) {
          entries.push({
            hash: entry.hash,
            prompt: entry.prompt,
            provider: entry.provider,
            recordedAt: entry.recordedAt
          })
        }
        return entries
      }),

    startRecording: (hash, metadata) =>
      Effect.sync(() => {
        const id = `rec-${++nextId}`
        inProgress.set(id, {
          hash,
          prompt: metadata.prompt,
          provider: metadata.provider,
          events: []
        })
        return id
      }),

    appendEvent: (recordingId, event) =>
      Effect.sync(() => {
        const recording = inProgress.get(recordingId)
        if (recording) {
          recording.events.push(event)
        }
      }),

    finalizeRecording: (recordingId, result) =>
      Effect.sync(() => {
        const recording = inProgress.get(recordingId)
        if (recording) {
          recordings.set(recording.hash, {
            hash: recording.hash,
            prompt: recording.prompt,
            provider: recording.provider,
            streamData: recording.events,
            result,
            recordedAt: new Date()
          })
          inProgress.delete(recordingId)
        }
      })
  }
}

/**
 * In-memory ProviderRecorder layer.
 *
 * Uses a Map for storage. Suitable for testing with pre-seeded recordings
 * or for recording during test execution.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const recorder = yield* ProviderRecorder
 *   yield* recorder.save({ hash: "abc", ... })
 *   const entry = yield* recorder.load("abc")
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(InMemoryProviderRecorder)))
 * ```
 */
export const InMemoryProviderRecorder: Layer.Layer<ProviderRecorder> = Layer.succeed(
  ProviderRecorder,
  makeInMemoryProviderRecorder()
)
