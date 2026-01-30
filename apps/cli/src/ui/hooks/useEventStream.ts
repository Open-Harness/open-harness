/**
 * Hook for consuming the SSE event stream from the server.
 *
 * @module
 */

import { useCallback, useEffect, useRef, useState } from "react"

export interface StreamEvent {
  id: string
  name: string
  payload: unknown
  timestamp: Date
}

export type WorkflowStatus = "connecting" | "running" | "paused" | "complete" | "error"

export interface UseEventStreamResult {
  events: Array<StreamEvent>
  state: unknown
  phase: string
  status: WorkflowStatus
  isComplete: boolean
  streamingText: string
  respond: (value: string) => void
}

export function useEventStream(
  serverUrl: string,
  sessionId: string,
  options?: { includeHistory?: boolean }
): UseEventStreamResult {
  const [events, setEvents] = useState<Array<StreamEvent>>([])
  const [state, setState] = useState<unknown>(null)
  const [phase, setPhase] = useState<string>("")
  const [status, setStatus] = useState<WorkflowStatus>("connecting")
  const [streamingText, setStreamingText] = useState<string>("")
  const streamingAgentRef = useRef<string | null>(null)

  useEffect(() => {
    let aborted = false
    const controller = new AbortController()

    const processEvent = (data: string) => {
      if (data === "[DONE]") {
        setStatus("complete")
        return
      }

      try {
        const event = JSON.parse(data) as StreamEvent
        event.timestamp = new Date(event.timestamp)

        setEvents((prev) => [...prev, event])

        // Handle specific event types
        switch (event.name) {
          case "state:updated":
            setState((event.payload as { state: unknown }).state)
            break

          case "phase:entered":
            setPhase((event.payload as { phase: string }).phase)
            break

          case "agent:started":
            streamingAgentRef.current = (event.payload as { agent: string }).agent
            setStreamingText("")
            break

          case "agent:completed":
            streamingAgentRef.current = null
            setStreamingText("")
            break

          case "text:delta":
            setStreamingText((prev) => prev + (event.payload as { delta: string }).delta)
            break

          case "workflow:completed":
            setStatus("complete")
            break
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Use fetch-based SSE reader (works in Node.js, Bun, and browsers)
    const connect = async () => {
      try {
        const historyParam = options?.includeHistory ? "?history=true" : ""
        const response = await fetch(
          `${serverUrl}/sessions/${sessionId}/events${historyParam}`,
          { signal: controller.signal }
        )

        if (!response.ok || !response.body) {
          setStatus("error")
          return
        }

        setStatus("running")

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (!aborted) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              processEvent(line.slice(6))
            }
          }
        }
      } catch {
        if (!aborted) {
          setStatus("error")
        }
      }
    }

    connect()

    return () => {
      aborted = true
      controller.abort()
    }
  }, [serverUrl, sessionId])

  const respond = useCallback((value: string) => {
    fetch(`${serverUrl}/sessions/${sessionId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    }).catch(() => {
      // Ignore errors
    })
  }, [serverUrl, sessionId])

  return {
    events,
    state,
    phase,
    status,
    isComplete: status === "complete",
    streamingText,
    respond
  }
}
