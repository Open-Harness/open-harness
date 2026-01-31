/**
 * Route handlers for Open Scaffold HTTP API.
 *
 * Uses the executeWorkflow runtime from @open-scaffold/core Engine API.
 *
 * @module
 */

import { Effect, Fiber, Schema } from "effect"

import {
  computeStateAt,
  decodeSerializedEvent,
  makeEvent,
  SessionIdSchema,
  SessionNotFound,
  tagToEventName,
  ValidationError
} from "@open-scaffold/core"
// executeWorkflow is internal API (ADR-001) - import from internal entrypoint
import type { ProviderMode, SerializedEvent, SessionId, WorkflowDef } from "@open-scaffold/core"
import { executeWorkflow, Services } from "@open-scaffold/core/internal"

import { forkSession } from "../programs/forkSession.js"
import { observeEvents, type ObserveEventsOptions } from "../programs/observeEvents.js"

import { ServerError } from "./Server.js"
import { eventStreamToSSE, SSE_HEADERS } from "./SSE.js"

/**
 * Route context from HTTP request.
 *
 * Uses the WorkflowDef type from Engine API.
 * No stateCache — state is computed from EventStore events via computeStateAt.
 */
export interface RouteContext<S = unknown> {
  readonly params: Record<string, string>
  readonly query: Record<string, string>
  readonly body: unknown
  readonly workflow: WorkflowDef<S, string, string>
  readonly sessions: Map<SessionId, Fiber.RuntimeFiber<unknown, unknown>>
  readonly providerStatus?: ProviderStatus
}

/**
 * Response to return from a route handler.
 */
export interface RouteResponse {
  readonly status: number
  readonly body: unknown
  readonly headers?: Record<string, string>
}

export type RouteEnvironment =
  | Services.EventStore
  | Services.EventBus
  | Services.ProviderRecorder
  | Services.ProviderModeContext

export interface ProviderStatus {
  readonly name: string
  /** Provider mode: "live" (call API) or "playback" (replay recordings) */
  readonly mode: ProviderMode
  readonly model?: string
  readonly connected: boolean
}

const decodeSessionId = Schema.decodeUnknown(SessionIdSchema)

const parseSessionIdOrFail = (raw: string) =>
  decodeSessionId(raw).pipe(
    Effect.mapError(() => new ValidationError({ message: "invalid session id" }))
  )

/**
 * Create session route handler.
 *
 * POST /sessions
 * Body: { input: string }
 * Response: { sessionId: string }
 *
 * Uses executeWorkflow from the Next runtime API.
 */
export const createSessionRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const { workflow } = _ctx
    const input = (_ctx.body as { input?: string } | null)?.input
    if (!input) {
      return yield* Effect.fail(new ValidationError({ message: "input is required" }))
    }

    // Generate a session ID
    const sessionId = crypto.randomUUID() as SessionId

    // Fork executeWorkflow as a daemon so it continues after the route completes.
    const workflowEffect = executeWorkflow(workflow, {
      input,
      sessionId
    }).pipe(
      Effect.tapError((error) => Effect.log("Workflow execution failed", { sessionId, error: String(error) }))
    )

    const fiber = yield* Effect.forkDaemon(workflowEffect)
    _ctx.sessions.set(sessionId, fiber as Fiber.RuntimeFiber<unknown, unknown>)

    // Auto-cleanup: remove fiber from sessions map when it completes naturally
    fiber.addObserver(() => {
      _ctx.sessions.delete(sessionId)
    })

    // Yield to scheduler to ensure the forked fiber gets a chance to start
    yield* Effect.yieldNow()

    return {
      status: 201,
      body: { sessionId }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

/**
 * List sessions route handler.
 *
 * GET /sessions
 * Response: { sessions: Array<{ sessionId, running, eventCount, lastEventAt }> }
 */
export const listSessionsRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const store = yield* Services.EventStore
    const sessionIds = yield* store.listSessions()

    const sessions = []
    for (const sessionId of sessionIds) {
      const events = yield* store.getEvents(sessionId)
      const last = events.at(-1)
      sessions.push({
        sessionId,
        running: _ctx.sessions.has(sessionId),
        eventCount: events.length,
        lastEventAt: last
          ? new Date(last.timestamp).toISOString()
          : null
      })
    }

    return {
      status: 200,
      body: { sessions }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

/**
 * Get session status route handler.
 *
 * GET /sessions/:id
 * Response: { sessionId: string, running: boolean }
 */
export const getSessionRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const sessionId = yield* parseSessionIdOrFail(_ctx.params.id)
    const store = yield* Services.EventStore
    const sessions = yield* store.listSessions()
    const exists = sessions.some((id) => id === sessionId)
    if (!exists) {
      return yield* Effect.fail(new SessionNotFound({ sessionId: String(sessionId) }))
    }

    return {
      status: 200,
      body: {
        sessionId,
        running: _ctx.sessions.has(sessionId)
      }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

/**
 * Get session events route handler (SSE).
 *
 * GET /sessions/:id/events
 * Response: SSE stream of events
 */
export const getSessionEventsRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const sessionId = yield* parseSessionIdOrFail(_ctx.params.id)

    const includeHistory = _ctx.query.history === "true" || _ctx.query.history === "1"
    const fromPositionRaw = _ctx.query.fromPosition
    const fromPosition = fromPositionRaw ? Number(fromPositionRaw) : undefined

    const options: ObserveEventsOptions = typeof fromPosition === "number" && !Number.isNaN(fromPosition)
      ? { sessionId, includeHistory, fromPosition }
      : { sessionId, includeHistory }

    const stream = observeEvents(options)

    return {
      status: 200,
      body: eventStreamToSSE(stream),
      headers: SSE_HEADERS
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

/**
 * Get session state route handler.
 *
 * GET /sessions/:id/state
 * Response: { state: S }
 *
 * Uses computeStateAt to scan state events from the EventStore.
 */
export const getSessionStateRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const sessionId = yield* parseSessionIdOrFail(_ctx.params.id)
    const store = yield* Services.EventStore
    const events = yield* store.getEvents(sessionId)

    const positionRaw = _ctx.query.position
    if (positionRaw !== undefined) {
      const position = Number(positionRaw)
      if (Number.isNaN(position)) {
        return yield* Effect.fail(new ValidationError({ message: "position must be a number" }))
      }
      const state = computeStateAt<S>(events, position)
      return {
        status: 200,
        body: {
          state: state ?? _ctx.workflow.initialState,
          position,
          eventsReplayed: Math.min(position, events.length)
        }
      }
    }

    // Default: compute state at current position (end of event log)
    const state = computeStateAt<S>(events, events.length)
    return {
      status: 200,
      body: { state: state ?? _ctx.workflow.initialState, events }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

/**
 * Post session input route handler.
 *
 * POST /sessions/:id/input
 * Body: { input: string }
 * Response: { ok: true }
 *
 * Uses makeEvent to create input:received events and
 * appends directly to EventStore/EventBus.
 */
export const postSessionInputRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const sessionId = yield* parseSessionIdOrFail(_ctx.params.id)
    const body = _ctx.body as { event?: unknown; input?: string } | null
    const input = body?.input
    const rawEvent = body?.event

    // If a raw event was provided, decode it with schema validation; otherwise create an input:received event
    const event: SerializedEvent | null = rawEvent
      ? yield* decodeSerializedEvent(rawEvent).pipe(
        Effect.mapError(() => new ValidationError({ message: "invalid event format" }))
      )
      : input
      ? yield* makeEvent(tagToEventName.InputReceived, { response: input })
      : null

    if (!event) {
      return yield* Effect.fail(new ValidationError({ message: "input is required" }))
    }

    // Persist and broadcast
    const store = yield* Services.EventStore
    const bus = yield* Services.EventBus
    yield* store.append(sessionId, event)
    yield* bus.publish(sessionId, event)

    return {
      status: 200,
      body: { ok: true }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

/**
 * Delete session route handler.
 *
 * DELETE /sessions/:id
 * Response: { ok: true }
 */
export const deleteSessionRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const sessionId = yield* parseSessionIdOrFail(_ctx.params.id)
    const running = _ctx.sessions.get(sessionId)
    if (running) {
      yield* Fiber.interrupt(running)
      _ctx.sessions.delete(sessionId)
    }

    const store = yield* Services.EventStore
    yield* store.deleteSession(sessionId)

    return {
      status: 200,
      body: { ok: true }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

// ─────────────────────────────────────────────────────────────────
// VCR Control Routes
// ─────────────────────────────────────────────────────────────────

/**
 * Pause session route handler.
 *
 * POST /sessions/:id/pause
 * Response: { ok: true, wasPaused: boolean }
 *
 * Interrupts the running session fiber without deleting the session data.
 * If the session is not running, returns success with wasPaused: false.
 */
export const pauseSessionRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const sessionId = yield* parseSessionIdOrFail(_ctx.params.id)

    // Check session exists
    const store = yield* Services.EventStore
    const sessions = yield* store.listSessions()
    const exists = sessions.some((id) => id === sessionId)
    if (!exists) {
      return yield* Effect.fail(new SessionNotFound({ sessionId: String(sessionId) }))
    }

    const running = _ctx.sessions.get(sessionId)
    if (running) {
      yield* Fiber.interrupt(running)
      _ctx.sessions.delete(sessionId)
      yield* Effect.log("Session paused", { sessionId })
      return {
        status: 200,
        body: { ok: true, wasPaused: true }
      }
    }

    return {
      status: 200,
      body: { ok: true, wasPaused: false }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

/**
 * Resume session route handler.
 *
 * POST /sessions/:id/resume
 * Response: { ok: true, wasResumed: boolean }
 *
 * Resumes a paused session by loading events, computing state, and
 * restarting workflow execution using executeWorkflow with resumeState.
 * If the session is already running, returns success with wasResumed: false.
 */
export const resumeSessionRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const sessionId = yield* parseSessionIdOrFail(_ctx.params.id)
    const { workflow } = _ctx

    // Check if already running
    if (_ctx.sessions.has(sessionId)) {
      return {
        status: 200,
        body: { ok: true, wasResumed: false }
      }
    }

    // Load events and compute current state from EventStore
    const store = yield* Services.EventStore
    const events = yield* store.getEvents(sessionId)
    const resumeState = computeStateAt<S>(events, events.length) ?? workflow.initialState

    // Determine the current phase from events (scan backwards for last phase:entered)
    let resumePhase: string | undefined
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].name === tagToEventName.PhaseEntered) {
        resumePhase = (events[i].payload as { phase: string }).phase
        break
      }
    }

    // Resume using executeWorkflow with resumeState
    const resumeOptions = {
      input: "" as string, // Input not needed for resume (start() is skipped)
      sessionId,
      resumeState,
      ...(resumePhase !== undefined ? { resumePhase } : {})
    }
    const resumeEffect = executeWorkflow(workflow, resumeOptions).pipe(
      Effect.tapError((error) => Effect.log("Resume workflow failed", { sessionId, error: String(error) }))
    )

    // Fork as daemon so it continues after the route completes
    const fiber = yield* Effect.forkDaemon(resumeEffect)
    _ctx.sessions.set(sessionId, fiber as Fiber.RuntimeFiber<unknown, unknown>)

    // Auto-cleanup: remove fiber from sessions map when it completes naturally
    fiber.addObserver(() => {
      _ctx.sessions.delete(sessionId)
    })

    yield* Effect.log("Session resumed", { sessionId })

    return {
      status: 200,
      body: { ok: true, wasResumed: true }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

/**
 * Fork session route handler.
 *
 * POST /sessions/:id/fork
 * Response: { sessionId: string, eventsCopied: number }
 *
 * Creates a new session by copying all events from the original session.
 */
export const forkSessionRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const sessionId = yield* parseSessionIdOrFail(_ctx.params.id)

    const result = yield* forkSession(sessionId)

    return {
      status: 201,
      body: {
        sessionId: result.newSessionId,
        originalSessionId: result.originalSessionId,
        eventsCopied: result.eventsCopied
      }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

// Note: stepSessionRoute removed - "step" is a client-side concept
// Clients navigate through recorded history using useStateAt(position) which calls
// GET /sessions/:id/state?position=N (already implemented above)

/**
 * List recordings route handler.
 *
 * GET /recordings
 * Response: { recordings: Array<{ hash, prompt, provider, recordedAt }> }
 */
export const listRecordingsRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const recorder = yield* Services.ProviderRecorder
    const recordings = yield* recorder.list()
    return {
      status: 200,
      body: { recordings }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

/**
 * Get recording route handler.
 *
 * GET /recordings/:id
 * Response: { hash, prompt, provider, result, streamData, recordedAt }
 */
export const getRecordingRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const hash = _ctx.params.id
    const recorder = yield* Services.ProviderRecorder
    const entry = yield* recorder.load(hash)
    if (!entry) {
      return yield* Effect.fail(new ValidationError({ message: "recording not found" }))
    }
    return {
      status: 200,
      body: {
        hash: entry.hash,
        prompt: entry.prompt,
        provider: entry.provider,
        result: entry.result,
        streamData: entry.streamData,
        recordedAt: entry.recordedAt
      }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

/**
 * Delete recording route handler.
 *
 * DELETE /recordings/:id
 * Response: { ok: true }
 */
export const deleteRecordingRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  return Effect.gen(function*() {
    const hash = _ctx.params.id
    const recorder = yield* Services.ProviderRecorder
    yield* recorder.delete(hash)
    return {
      status: 200,
      body: { ok: true }
    }
  }).pipe(
    Effect.mapError((cause) => new ServerError({ operation: "request", cause }))
  )
}

/**
 * Provider status route handler.
 *
 * GET /providers/status
 * Response: { provider: ProviderStatus }
 */
export const getProviderStatusRoute = <S>(
  _ctx: RouteContext<S>
): Effect.Effect<RouteResponse, ServerError, RouteEnvironment> => {
  const status = _ctx.providerStatus ?? {
    name: "unknown",
    mode: "live" as const,
    connected: true
  }
  return Effect.succeed({
    status: 200,
    body: { provider: status }
  })
}
