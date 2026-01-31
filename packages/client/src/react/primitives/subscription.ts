/**
 * SSE subscription hook for React Query cache updates.
 *
 * Per ADR-013: Subscribes to Server-Sent Events and updates the React Query
 * cache with incoming workflow events.
 *
 * @internal
 * @module
 */

import { type SerializedEvent, SerializedEventSchema } from "@open-scaffold/core"
import { useQueryClient } from "@tanstack/react-query"
import { Option, Schema } from "effect"
import { useEffect } from "react"

import { useWorkflowClient } from "../WorkflowClientProvider.js"
import { workflowKeys } from "./queries.js"

// Schema decoder for SSE events - returns Option to gracefully skip malformed events
const decodeSSEEvent = Schema.decodeUnknownOption(SerializedEventSchema)

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
        // Parse and validate SSE data with Effect Schema (ADR-004 wire format)
        const parsed = decodeSSEEvent(JSON.parse(e.data))
        if (Option.isNone(parsed)) {
          console.warn("Received malformed SSE event, skipping")
          return
        }
        const event = parsed.value

        // Append to events cache
        queryClient.setQueryData<ReadonlyArray<SerializedEvent>>(
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
