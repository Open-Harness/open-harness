/**
 * Integration test: EventBus broadcast.
 *
 * Verifies that the PubSub-backed EventBusLive correctly broadcasts events
 * during workflow execution. Uses Effect's PubSub to subscribe before workflow
 * start and collects events published during execution.
 */

import { Effect, Fiber, Layer, PubSub, Stream } from "effect"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { agent, type AnyEvent, EVENTS, Services, type SessionId, workflow } from "@open-scaffold/core"
// executeWorkflow is internal API (ADR-001) - import from internal entrypoint
import { executeWorkflow } from "@open-scaffold/core/internal"

import { EventBusLive } from "../src/index.js"
import { EventStoreLive } from "../src/internal.js"

// ─────────────────────────────────────────────────────────────────
// Mock provider (inline, same pattern as core tests)
// ─────────────────────────────────────────────────────────────────

const mockProvider = {
  name: "mock-provider",
  stream: (options: { prompt: string }) => {
    const events = []
    if (options.prompt.includes("Goal:")) {
      events.push({ _tag: "Result" as const, output: { message: "broadcast-test" }, stopReason: "end_turn" as const })
    } else {
      events.push({ _tag: "Result" as const, output: { message: "default" }, stopReason: "end_turn" as const })
    }
    return Stream.fromIterable(events)
  }
}

// ─────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────

interface BusTestState {
  goal: string
  message: string
}

const testAgent = agent<BusTestState, { message: string }>({
  name: "bus-agent",
  model: "claude-sonnet-4-5",
  output: z.object({ message: z.string() }),
  prompt: (state) => `Goal: ${state.goal}`,
  update: (output, draft) => {
    draft.message = output.message
  }
})

const testWorkflow = workflow<BusTestState>({
  name: "bus-test",
  initialState: { goal: "", message: "" },
  start: (input, draft) => {
    draft.goal = input
  },
  agent: testAgent,
  until: () => true
})

// Noop recorder
const noopRecorder: Services.ProviderRecorderService = {
  load: () => Effect.succeed(null),
  save: () => Effect.void,
  delete: () => Effect.void,
  list: () => Effect.succeed([]),
  startRecording: () => Effect.succeed("noop"),
  appendEvent: () => Effect.void,
  finalizeRecording: () => Effect.void
}

// ─────────────────────────────────────────────────────────────────
// Test
// ─────────────────────────────────────────────────────────────────

describe("EventBus broadcast integration", () => {
  it("broadcasts events via PubSub-backed EventBusLive during workflow execution", async () => {
    const sessionId = crypto.randomUUID() as string

    // Build a complete layer with real PubSub EventBus, real LibSQL EventStore,
    // and mock provider/recorder
    const registryService = (await import("@open-scaffold/core")).makeInMemoryProviderRegistry()
    const { ProviderRegistry } = await import("@open-scaffold/core")

    const ProviderRegistryLayer = Layer.effect(
      ProviderRegistry,
      Effect.gen(function*() {
        yield* registryService.registerProvider("claude-sonnet-4-5", mockProvider)
        return registryService
      })
    )

    const ProviderModeLayer = Layer.succeed(Services.ProviderModeContext, { mode: "live" as const })
    const ProviderRecorderLayer = Layer.succeed(Services.ProviderRecorder, noopRecorder)
    const EventStoreLayer = EventStoreLive({ url: ":memory:" })
    const EventBusLayer = Layer.effect(Services.EventBus, EventBusLive)

    const fullLayer = Layer.mergeAll(
      ProviderRegistryLayer,
      ProviderModeLayer,
      ProviderRecorderLayer,
      EventStoreLayer,
      EventBusLayer
    )

    // Run a program that:
    // 1. Subscribes to the EventBus for this session
    // 2. Forks the subscription
    // 3. Executes the workflow
    // 4. Joins the subscriber to get broadcast events
    const program = Effect.gen(function*() {
      const bus = yield* Services.EventBus

      // Subscribe to events for our session
      const subscriberFiber = yield* Effect.fork(
        bus.subscribe(sessionId as SessionId).pipe(
          Stream.takeUntil((event) => event.name === EVENTS.WORKFLOW_COMPLETED),
          Stream.runCollect
        )
      )

      // Give the subscriber time to set up
      yield* Effect.sleep("25 millis")

      // Execute workflow (this publishes events to EventBus)
      const result = yield* executeWorkflow(testWorkflow, {
        input: "Broadcast this",
        sessionId
      })

      // Collect broadcast events
      const broadcastChunk = yield* Fiber.join(subscriberFiber)
      const broadcastedEvents = Array.from(broadcastChunk)

      return { result, broadcastedEvents }
    }).pipe(Effect.provide(fullLayer))

    const { broadcastedEvents, result } = await Effect.runPromise(program)

    // Verify workflow completed
    expect(result.completed).toBe(true)
    expect(result.state.message).toBe("broadcast-test")

    // Verify events were broadcast through the EventBus
    expect(broadcastedEvents.length).toBeGreaterThan(0)

    const eventNames = broadcastedEvents.map((e: AnyEvent) => e.name)

    // Key lifecycle events should have been broadcast
    expect(eventNames).toContain(EVENTS.WORKFLOW_STARTED)
    expect(eventNames).toContain(EVENTS.WORKFLOW_COMPLETED)
    expect(eventNames).toContain(EVENTS.STATE_UPDATED)

    // Events should arrive in order
    const startedIdx = eventNames.indexOf(EVENTS.WORKFLOW_STARTED)
    const completedIdx = eventNames.indexOf(EVENTS.WORKFLOW_COMPLETED)
    expect(startedIdx).toBeLessThan(completedIdx)
  }, 15000)
})
