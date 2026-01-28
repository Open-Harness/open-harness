/**
 * HTTP+SSE implementation of WorkflowClient.
 *
 * @module
 */

import type { AnyEvent } from "@open-scaffold/core"

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
  let stream: AsyncIterable<AnyEvent> | null = null
  let abortController: AbortController | null = null

  const baseUrl = config.url.replace(/\/+$/, "")

  const buildUrl = (path: string) => new URL(path, baseUrl).toString()

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

    const eventStream = async function*(): AsyncIterable<AnyEvent> {
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
              const event = JSON.parse(message.data) as AnyEvent
              if (event?.id && !seen.has(event.id)) {
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
    const response = await requestJson<{ sessionId: string }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ input })
    })
    return response.sessionId
  }

  const events = (): AsyncIterable<AnyEvent> => {
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

  const sendInput = async (event: AnyEvent): Promise<void> => {
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
    return requestJson<SessionInfo>(`/sessions/${sessionId}`)
  }

  const pause = async (): Promise<PauseResult> => {
    const sessionId = ensureSession()
    return requestJson<PauseResult>(`/sessions/${sessionId}/pause`, {
      method: "POST"
    })
  }

  const resume = async (): Promise<ResumeResult> => {
    const sessionId = ensureSession()
    return requestJson<ResumeResult>(`/sessions/${sessionId}/resume`, {
      method: "POST"
    })
  }

  const fork = async (): Promise<ForkResult> => {
    const sessionId = ensureSession()
    return requestJson<ForkResult>(`/sessions/${sessionId}/fork`, {
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
