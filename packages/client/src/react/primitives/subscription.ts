/**
 * SSE subscription hook for React Query cache updates.
 *
 * Per ADR-013: Subscribes to Server-Sent Events and updates the React Query
 * cache with incoming workflow events.
 *
 * @internal
 * @module
 */

import type { AnyEvent, EventId } from "@open-scaffold/core"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { useWorkflowClient } from "../WorkflowClientProvider.js"
import { workflowKeys } from "./queries.js"

/**
 * SSE event format (JSON with numeric timestamp).
 * This matches the SerializedEvent format from the server.
 */
interface SSEEvent {
  readonly id: string
  readonly name: string
  readonly payload: Record<string, unknown>
  readonly timestamp: number
  readonly causedBy?: string
}

/**
 * Convert SSE event (with numeric timestamp) to AnyEvent (with Date).
 */
const parseSSEEvent = (sseEvent: SSEEvent): AnyEvent => ({
  id: sseEvent.id as EventId,
  name: sseEvent.name,
  payload: sseEvent.payload,
  timestamp: new Date(sseEvent.timestamp),
  ...(sseEvent.causedBy !== undefined ? { causedBy: sseEvent.causedBy as EventId } : {})
})

/**
 * @internal
 * Subscribes to SSE events and updates React Query cache.
 *
 * - Appends new events to ['workflow', 'events', sessionId] cache
 * - Invalidates ['workflow', 'state', sessionId, *] on state-changing events
 * - Invalidates ['workflow', 'session', sessionId] on workflow completion
 *
 * @param sessionId - The session ID to subscribe to (null disables subscription)
 *
 * @example
 * ```tsx
 * // Internal use within grouped hooks
 * function useWorkflowSession(sessionId: string | null) {
 *   useEventSubscription(sessionId)
 *   const { data: events } = useEventsQuery(sessionId)
 *   // events are kept up-to-date by SSE
 * }
 * ```
 */
export const useEventSubscription = (sessionId: string | null) => {
  const { baseUrl } = useWorkflowClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!sessionId) return

    const eventSource = new EventSource(
      `${baseUrl}/sessions/${sessionId}/events`
    )

    eventSource.onmessage = (e) => {
      try {
        const sseEvent = JSON.parse(e.data) as SSEEvent
        const event = parseSSEEvent(sseEvent)

        // Append to events cache
        queryClient.setQueryData<ReadonlyArray<AnyEvent>>(
          workflowKeys.events(sessionId),
          (old = []) => [...old, event]
        )

        // Invalidate state cache when state changes
        if (event.name === "state:intent" || event.name === "state:checkpoint") {
          queryClient.invalidateQueries({
            queryKey: ["workflow", "state", sessionId],
            exact: false
          })
        }

        // Invalidate session cache on completion
        if (event.name === "workflow:completed") {
          queryClient.invalidateQueries({
            queryKey: workflowKeys.session(sessionId)
          })
        }
      } catch (err) {
        console.error("Failed to parse SSE event:", err)
      }
    }

    eventSource.onerror = () => {
      // React Query will handle retry via refetch
      queryClient.invalidateQueries({ queryKey: workflowKeys.events(sessionId) })
    }

    return () => eventSource.close()
  }, [sessionId, baseUrl, queryClient])
}
