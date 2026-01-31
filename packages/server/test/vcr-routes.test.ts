/**
 * VCR HTTP routes tests.
 *
 * Tests route handlers directly using real LibSQL :memory: stores.
 * Routes use the new executeWorkflow / WorkflowDef / computeStateAt API.
 *
 * @module
 */

import type { Fiber } from "effect"
import { Effect, Layer } from "effect"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  agent,
  makeEvent,
  phase,
  type SerializedEvent,
  type SessionId,
  tagToEventName,
  workflow,
  type WorkflowDef
} from "@open-harness/core"
import { Services } from "@open-harness/core/internal"
import {
  deleteSessionRoute,
  forkSessionRoute,
  getSessionRoute,
  getSessionStateRoute,
  listSessionsRoute,
  pauseSessionRoute,
  postSessionInputRoute,
  resumeSessionRoute
} from "../src/http/Routes.js"
import { makeInMemoryRecorderLayer, ServerError } from "../src/http/Server.js"
import { EventBusLive } from "../src/index.js"
import { EventStoreLive, type RouteContext, StateSnapshotStoreLive } from "../src/internal.js"
import { recordEvent } from "../src/internal.js"

// ─────────────────────────────────────────────────────────────────
// Test Workflow
// ─────────────────────────────────────────────────────────────────

interface TestState {
  goal: string
  tasks: Array<string>
  done: boolean
}

type TestPhases = "planning" | "done"

// Per ADR-010: Agents own their provider directly
const testProvider = {
  name: "test-provider",
  model: "test-model",
  stream: () => {
    throw new Error("Should not be called in playback mode")
  }
}

const testAgent = agent<TestState, { message: string }>({
  name: "test-agent",
  provider: testProvider,
  output: z.object({ message: z.string() }),
  prompt: (state) => `Goal: ${state.goal}`,
  update: (output, draft) => {
    draft.tasks.push(output.message)
  }
})

const testWorkflow = workflow<TestState, string, TestPhases>({
  name: "test-workflow",
  initialState: { goal: "", tasks: [], done: false },
  start: (input, draft) => {
    draft.goal = input
  },
  phases: {
    planning: { run: testAgent, next: "done" },
    done: phase.terminal()
  }
}) as WorkflowDef<TestState, string, string>

// ─────────────────────────────────────────────────────────────────
// Test Layer
// ─────────────────────────────────────────────────────────────────

const mkEvent = (name: string, payload: Record<string, unknown>): SerializedEvent =>
  Effect.runSync(makeEvent(name, payload))

const makeTestLayer = () => {
  // Note: Per ADR-010, ProviderRegistry is no longer needed - agents own their providers directly
  return Layer.mergeAll(
    EventStoreLive({ url: ":memory:" }),
    StateSnapshotStoreLive({ url: ":memory:" }),
    makeInMemoryRecorderLayer(),
    Layer.effect(Services.EventBus, EventBusLive),
    Layer.succeed(Services.ProviderModeContext, { mode: "playback" as const })
  )
}

const makeCtx = (overrides: Partial<RouteContext<TestState>> = {}): RouteContext<TestState> => ({
  params: {},
  query: {},
  body: null,
  workflow: testWorkflow,
  sessions: new Map<SessionId, Fiber.RuntimeFiber<unknown, unknown>>(),
  ...overrides
})

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("VCR HTTP Routes", () => {
  it("pauseSessionRoute interrupts running session", async () => {
    const layer = makeTestLayer()
    const sessions = new Map<SessionId, Fiber.RuntimeFiber<unknown, unknown>>()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      // Persist an event so the session exists in store
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.WorkflowStarted, { sessionId, workflowName: "test", input: "go" })
      )

      // Fake a running fiber
      const fiber = yield* Effect.fork(Effect.sleep("10 seconds"))
      sessions.set(sessionId, fiber as Fiber.RuntimeFiber<unknown, unknown>)

      const ctx = makeCtx({ params: { id: sessionId }, sessions })
      const response = yield* pauseSessionRoute(ctx)

      return { response, sessionId }
    }).pipe(Effect.provide(layer))

    const { response } = await Effect.runPromise(program)
    expect(response.status).toBe(200)
    expect((response.body as { wasPaused: boolean }).wasPaused).toBe(true)
  })

  it("pauseSessionRoute returns wasPaused:false for non-running session", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.WorkflowStarted, { sessionId, workflowName: "test", input: "go" })
      )

      const ctx = makeCtx({ params: { id: sessionId } })
      return yield* pauseSessionRoute(ctx)
    }).pipe(Effect.provide(layer))

    const response = await Effect.runPromise(program)
    expect(response.status).toBe(200)
    expect((response.body as { wasPaused: boolean }).wasPaused).toBe(false)
  })

  it("pauseSessionRoute fails for non-existent session", async () => {
    const layer = makeTestLayer()
    const sessionId = crypto.randomUUID() as SessionId

    const program = pauseSessionRoute(makeCtx({ params: { id: sessionId } })).pipe(
      Effect.provide(layer),
      Effect.flip
    )

    const error = await Effect.runPromise(program)
    expect(error).toBeInstanceOf(ServerError)
  })

  it("resumeSessionRoute returns wasResumed:false for already running session", async () => {
    const layer = makeTestLayer()
    const sessions = new Map<SessionId, Fiber.RuntimeFiber<unknown, unknown>>()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId

      // Mark as running
      const fiber = yield* Effect.fork(Effect.sleep("10 seconds"))
      sessions.set(sessionId, fiber as Fiber.RuntimeFiber<unknown, unknown>)

      const ctx = makeCtx({ params: { id: sessionId }, sessions })
      return yield* resumeSessionRoute(ctx)
    }).pipe(Effect.provide(layer))

    const response = await Effect.runPromise(program)
    expect(response.status).toBe(200)
    expect((response.body as { wasResumed: boolean }).wasResumed).toBe(false)
  })

  it("forkSessionRoute creates new session with copied events", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.WorkflowStarted, { sessionId, workflowName: "test", input: "go" })
      )
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.StateIntent, { state: { goal: "test", tasks: [], done: false } })
      )

      const ctx = makeCtx({ params: { id: sessionId } })
      return yield* forkSessionRoute(ctx)
    }).pipe(Effect.provide(layer))

    const response = await Effect.runPromise(program)
    expect(response.status).toBe(201)
    const body = response.body as { sessionId: string; eventsCopied: number }
    expect(body.eventsCopied).toBe(2)
    expect(body.sessionId).toBeDefined()
  })

  it("forkSessionRoute fails for non-existent session", async () => {
    const layer = makeTestLayer()
    const sessionId = crypto.randomUUID() as SessionId

    const program = forkSessionRoute(makeCtx({ params: { id: sessionId } })).pipe(
      Effect.provide(layer),
      Effect.flip
    )

    const error = await Effect.runPromise(program)
    expect(error).toBeInstanceOf(ServerError)
  })

  it("listSessionsRoute returns all sessions", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const s1 = crypto.randomUUID() as SessionId
      const s2 = crypto.randomUUID() as SessionId
      yield* recordEvent(
        s1,
        mkEvent(tagToEventName.WorkflowStarted, { sessionId: s1, workflowName: "test", input: "a" })
      )
      yield* recordEvent(
        s2,
        mkEvent(tagToEventName.WorkflowStarted, { sessionId: s2, workflowName: "test", input: "b" })
      )

      const ctx = makeCtx()
      return yield* listSessionsRoute(ctx)
    }).pipe(Effect.provide(layer))

    const response = await Effect.runPromise(program)
    expect(response.status).toBe(200)
    const body = response.body as { sessions: Array<{ sessionId: string }> }
    expect(body.sessions).toHaveLength(2)
  })

  it("getSessionRoute returns session status", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.WorkflowStarted, { sessionId, workflowName: "test", input: "go" })
      )

      const ctx = makeCtx({ params: { id: sessionId } })
      return yield* getSessionRoute(ctx)
    }).pipe(Effect.provide(layer))

    const response = await Effect.runPromise(program)
    expect(response.status).toBe(200)
    expect((response.body as { running: boolean }).running).toBe(false)
  })

  it("getSessionStateRoute computes state from events", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.WorkflowStarted, { sessionId, workflowName: "test", input: "go" })
      )
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.StateIntent, { state: { goal: "test", tasks: ["a"], done: false } })
      )

      const ctx = makeCtx({ params: { id: sessionId } })
      return yield* getSessionStateRoute(ctx)
    }).pipe(Effect.provide(layer))

    const response = await Effect.runPromise(program)
    expect(response.status).toBe(200)
    const body = response.body as { state: TestState }
    expect(body.state.goal).toBe("test")
    expect(body.state.tasks).toEqual(["a"])
  })

  it("getSessionStateRoute at specific position", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.StateIntent, { state: { goal: "v1", tasks: [], done: false } })
      )
      yield* recordEvent(sessionId, mkEvent(tagToEventName.AgentStarted, { agent: "a1" }))
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.StateIntent, { state: { goal: "v2", tasks: ["a"], done: false } })
      )

      const ctx = makeCtx({ params: { id: sessionId }, query: { position: "1" } })
      return yield* getSessionStateRoute(ctx)
    }).pipe(Effect.provide(layer))

    const response = await Effect.runPromise(program)
    expect(response.status).toBe(200)
    const body = response.body as { state: TestState; position: number }
    expect(body.state.goal).toBe("v1")
    expect(body.position).toBe(1)
  })

  it("postSessionInputRoute records input event", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.WorkflowStarted, { sessionId, workflowName: "test", input: "go" })
      )

      const ctx = makeCtx({
        params: { id: sessionId },
        body: { input: "user response" }
      })
      const response = yield* postSessionInputRoute(ctx)

      const store = yield* Services.EventStore
      const events = yield* store.getEvents(sessionId)

      return { response, events }
    }).pipe(Effect.provide(layer))

    const { events, response } = await Effect.runPromise(program)
    expect(response.status).toBe(200)
    expect((response.body as { ok: boolean }).ok).toBe(true)
    // Should have the original event + the input response event
    expect(events).toHaveLength(2)
    expect(events[1].name).toBe(tagToEventName.InputReceived)
  })

  it("deleteSessionRoute removes session data", async () => {
    const layer = makeTestLayer()

    const program = Effect.gen(function*() {
      const sessionId = crypto.randomUUID() as SessionId
      yield* recordEvent(
        sessionId,
        mkEvent(tagToEventName.WorkflowStarted, { sessionId, workflowName: "test", input: "go" })
      )

      const ctx = makeCtx({ params: { id: sessionId } })
      const response = yield* deleteSessionRoute(ctx)

      const store = yield* Services.EventStore
      const sessions = yield* store.listSessions()

      return { response, sessions, sessionId }
    }).pipe(Effect.provide(layer))

    const { response, sessionId, sessions } = await Effect.runPromise(program)
    expect(response.status).toBe(200)
    expect((response.body as { ok: boolean }).ok).toBe(true)
    expect(sessions).not.toContain(sessionId)
  })
})
