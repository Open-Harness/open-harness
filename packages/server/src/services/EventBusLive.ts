import type { SerializedEvent, SessionId } from "@open-harness/core"
import { Services } from "@open-harness/core/internal"
import { Effect, PubSub, Stream } from "effect"

/**
 * Live EventBus backed by an unbounded PubSub.
 *
 * We publish all events into a single bus and filter by sessionId at
 * subscription time to keep the core EventBus interface unchanged.
 */
export const EventBusLive = Effect.gen(function*() {
  const bus = yield* PubSub.unbounded<{ sessionId: SessionId; event: SerializedEvent }>()

  return Services.EventBus.of({
    publish: (sessionId, event) => PubSub.publish(bus, { sessionId, event }).pipe(Effect.asVoid),
    subscribe: (sessionId) =>
      Stream.unwrapScoped(
        PubSub.subscribe(bus).pipe(
          Effect.map((queue) =>
            Stream.fromQueue(queue).pipe(
              Stream.filter((item) => item.sessionId === sessionId),
              Stream.map((item) => item.event)
            )
          )
        )
      )
  })
})
