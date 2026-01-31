/**
 * HTTP+SSE implementation of WorkflowClient.
 *
 * Per ADR-005: API responses and SSE messages are validated using Effect Schema
 * at the boundary to ensure runtime type safety.
 *
 * @module
 */

import { EventIdSchema, type SerializedEvent } from "@open-harness/core"
import { Effect, Schema } from "effect"

import { ClientError } from "./Contract.js"
import type {
  ClientConfig,
  ConnectionStatus,
  ForkResult,
  PauseResult,
  ResumeResult,
  SessionInfo,
  StateAtResult,
  WorkflowClient
} from "./Contract.js"
import { createSSEStream } from "./SSE.js"

// ─────────────────────────────────────────────────────────────────
// API Response Schemas (ADR-005: Type Safety at API Boundaries)
// ─────────────────────────────────────────────────────────────────

/**
 * Schema for SSE event data (SerializedEvent).
 *
 * Validates the JSON-parsed event from SSE messages matches SerializedEvent structure.
 * Per ADR-005: Replace `as SerializedEvent` casts with schema validation.
 *
 * Note: timestamp is numeric (Unix ms) in SerializedEvent, but may be
 * ISO string from legacy sources. Schema accepts both formats.
 */
const SSEEventSchema = Schema.Struct({
  id: EventIdSchema,
  name: Schema.String,
  payload: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  timestamp: Schema.Union(
    Schema.Number,
    Schema.transform(Schema.String, Schema.Number, {
      decode: (s) => new Date(s).getTime(),
      encode: (n) => new Date(n).toISOString()
    })
  ),
  causedBy: Schema.optionalWith(EventIdSchema, { exact: true })
})

/** Decoder for SSE events - validates and transforms SSE message data */
const decodeSSEEvent = Schema.decodeUnknown(SSEEventSchema)

/**
 * Schema for createSession API response.
 */
const CreateSessionResponseSchema = Schema.Struct({
  sessionId: Schema.String
})

/**
 * Schema for getSession API response.
 */
const SessionInfoResponseSchema = Schema.Struct({
  sessionId: Schema.String,
  running: Schema.Boolean
})

/**
 * Schema for pause API response.
 */
const PauseResultSchema = Schema.Struct({
  ok: Schema.Boolean,
  wasPaused: Schema.Boolean
})

/**
 * Schema for resume API response.
 */
const ResumeResultSchema = Schema.Struct({
  ok: Schema.Boolean,
  wasResumed: Schema.Boolean
})

/**
 * Schema for fork API response.
 */
const ForkResultSchema = Schema.Struct({
  sessionId: Schema.String,
  originalSessionId: Schema.String,
  eventsCopied: Schema.Number
})

/**
 * Create an HTTP client for Open Scaffold workflows.
 *
 * @example
 * ```typescript
 * const client = HttpClient({ url: "http://localhost:42069" })
 * const sessionId = await client.createSession("Build a todo app")
 * await client.connect(sessionId)
 * ```
 */
export const HttpClient = (config: ClientConfig): WorkflowClient => {
  let status: ConnectionStatus = "disconnected"
  let activeSessionId: string | null = config.sessionId ?? null
  let stream: AsyncIterable<SerializedEvent> | null = null
  let abortController: AbortController | null = null

  const baseUrl = config.url.replace(/\/+$/, "")

  const buildUrl = (path: string) => new URL(path, baseUrl).toString()

  /**
   * Fetch JSON and validate with Effect Schema.
   * Per ADR-005: All API responses validated at boundary.
   */
  const requestWithSchema = async <A, I>(
    schema: Schema.Schema<A, I>,
    path: string,
    options?: RequestInit
  ): Promise<A> => {
    const response = await fetch(buildUrl(path), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(config.headers ?? {}),
        ...(options?.headers ?? {})
      }
    })

    if (!response.ok) {
      throw new ClientError({
        operation: "receive",
        cause: new Error(`Request failed: ${response.status}`)
      })
    }

    const json: unknown = await response.json()
    const result = Effect.runSync(
      Schema.decodeUnknown(schema)(json).pipe(
        Effect.mapError((parseError) =>
          new ClientError({
            operation: "receive",
            cause: new Error(`Invalid API response: ${parseError}`)
          })
        )
      )
    )
    return result
  }

  /**
   * Fetch JSON without schema validation (for endpoints with generic state).
   * Used by getState/getStateAt where the state type is user-defined.
   */
  const requestJson = async <T>(
    path: string,
    options?: RequestInit
  ): Promise<T> => {
    const response = await fetch(buildUrl(path), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(config.headers ?? {}),
        ...(options?.headers ?? {})
      }
    })

    if (!response.ok) {
      throw new ClientError({
        operation: "receive",
        cause: new Error(`Request failed: ${response.status}`)
      })
    }

    return response.json() as Promise<T>
  }

  const ensureSession = () => {
    if (!activeSessionId) {
      throw new ClientError({
        operation: "connect",
        cause: new Error("Session not set. Call connect() or createSession() first.")
      })
    }
    return activeSessionId
  }

  const connect = async (sessionId: string): Promise<void> => {
    activeSessionId = sessionId
    status = "connecting"

    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()

    const seen = new Set<string>()
    const signal = abortController.signal

    const eventStream = async function*(): AsyncIterable<SerializedEvent> {
      let attempt = 0
      let delay = 100

      while (!signal.aborted) {
        try {
          status = attempt === 0 ? "connecting" : "reconnecting"
          const response = await fetch(
            buildUrl(`/sessions/${sessionId}/events?history=true`),
            {
              signal,
              ...(config.headers ? { headers: config.headers } : {})
            }
          )

          if (!response.ok) {
            throw new ClientError({
              operation: "connect",
              cause: new Error(`SSE connection failed: ${response.status}`)
            })
          }

          status = "connected"

          for await (const message of createSSEStream(response)) {
            if (signal.aborted) return
            try {
              // Parse JSON first
              const parsed: unknown = JSON.parse(message.data)
              // Validate with Schema (ADR-005: no `as SerializedEvent` cast)
              const validated = Effect.runSync(
                decodeSSEEvent(parsed).pipe(
                  Effect.mapError((parseError) =>
                    new ClientError({
                      operation: "receive",
                      cause: new Error(`Invalid SSE event: ${parseError}`)
                    })
                  )
                )
              )
              // Build SerializedEvent with proper structure (ADR-004 wire format)
              const event: SerializedEvent = {
                id: validated.id,
                name: validated.name,
                payload: validated.payload,
                timestamp: validated.timestamp,
                ...(validated.causedBy !== undefined ? { causedBy: validated.causedBy } : {})
              }
              if (!seen.has(event.id)) {
                seen.add(event.id)
                yield event
              }
            } catch (cause) {
              throw new ClientError({ operation: "receive", cause })
            }
          }
        } catch (cause) {
          if (signal.aborted) return
          attempt += 1
          status = "reconnecting"
          if (attempt > 20) {
            status = "error"
            throw new ClientError({ operation: "connect", cause })
          }
          const jitter = 0.8 + Math.random() * 0.4
          const waitMs = Math.min(delay * jitter, 420690)
          await new Promise((resolve) => setTimeout(resolve, waitMs))
          delay = Math.min(delay * 2, 420690)
        }
      }
    }

    stream = eventStream()
  }

  const createSession = async (input: string): Promise<string> => {
    const response = await requestWithSchema(
      CreateSessionResponseSchema,
      "/sessions",
      {
        method: "POST",
        body: JSON.stringify({ input })
      }
    )
    return response.sessionId
  }

  const events = (): AsyncIterable<SerializedEvent> => {
    if (!stream) {
      throw new ClientError({
        operation: "connect",
        cause: new Error("Not connected. Call connect() first.")
      })
    }
    return stream
  }

  const getState = async <S>(): Promise<S> => {
    const sessionId = ensureSession()
    const response = await requestJson<{ state: S }>(`/sessions/${sessionId}/state`)
    return response.state
  }

  const getStateAt = async <S>(position: number): Promise<StateAtResult<S>> => {
    const sessionId = ensureSession()
    const response = await requestJson<StateAtResult<S>>(
      `/sessions/${sessionId}/state?position=${encodeURIComponent(String(position))}`
    )
    return response
  }

  const sendInput = async (event: SerializedEvent): Promise<void> => {
    const sessionId = ensureSession()
    await requestJson(`/sessions/${sessionId}/input`, {
      method: "POST",
      body: JSON.stringify({ event })
    })
  }

  const disconnect = async (): Promise<void> => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    stream = null
    status = "disconnected"
  }

  const getSession = async (): Promise<SessionInfo> => {
    const sessionId = ensureSession()
    return requestWithSchema(SessionInfoResponseSchema, `/sessions/${sessionId}`)
  }

  const pause = async (): Promise<PauseResult> => {
    const sessionId = ensureSession()
    return requestWithSchema(PauseResultSchema, `/sessions/${sessionId}/pause`, {
      method: "POST"
    })
  }

  const resume = async (): Promise<ResumeResult> => {
    const sessionId = ensureSession()
    return requestWithSchema(ResumeResultSchema, `/sessions/${sessionId}/resume`, {
      method: "POST"
    })
  }

  const fork = async (): Promise<ForkResult> => {
    const sessionId = ensureSession()
    return requestWithSchema(ForkResultSchema, `/sessions/${sessionId}/fork`, {
      method: "POST"
    })
  }

  return {
    createSession,
    connect,
    events,
    getState,
    getStateAt,
    sendInput,
    disconnect,
    getSession,
    pause,
    resume,
    fork,
    get status() {
      return status
    }
  }
}
