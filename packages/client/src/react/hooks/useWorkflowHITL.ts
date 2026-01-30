/**
 * Grouped hook for Human-in-the-Loop (HITL) interactions.
 *
 * Per ADR-013: Composes event queries and mutations to track pending
 * input requests and provide response capabilities.
 * This is part of the public API.
 *
 * @module
 */

import { useCallback, useMemo } from "react"

import { EVENTS, makeEventId } from "@open-scaffold/core"
import type { AnyEvent, EventId } from "@open-scaffold/core"
import { Effect } from "effect"

import { useEventsQuery, useSendInputMutation } from "../primitives/index.js"

/**
 * A pending human input request.
 */
export interface PendingInteraction {
  /** Unique ID for this interaction (correlates request to response) */
  readonly id: EventId
  /** The prompt text shown to the user */
  readonly prompt: string
  /** Type of input requested */
  readonly type: "freeform" | "approval" | "choice"
  /** Available options for choice type */
  readonly options?: ReadonlyArray<string>
  /** When the request was made */
  readonly timestamp: Date
}

/**
 * Result from useWorkflowHITL hook.
 */
export interface WorkflowHITLResult {
  /** List of pending input requests awaiting response */
  readonly pending: ReadonlyArray<PendingInteraction>

  /**
   * Respond to a pending interaction.
   * @param interactionId - The ID of the interaction to respond to
   * @param response - The user's response text
   */
  readonly respond: (interactionId: EventId, response: string) => Promise<void>

  /** Whether a response is being sent */
  readonly isResponding: boolean
}

/**
 * Hook for Human-in-the-Loop (HITL) workflow interactions.
 *
 * Tracks pending input requests and provides a way to respond to them.
 * Automatically filters out requests that have already received responses.
 *
 * @param sessionId - The session to monitor (null disables)
 * @returns HITL state and actions
 *
 * @example
 * ```tsx
 * function HITLPanel({ sessionId }: { sessionId: string }) {
 *   const { pending, respond, isResponding } = useWorkflowHITL(sessionId)
 *
 *   if (pending.length === 0) return null
 *
 *   const request = pending[0]
 *
 *   if (request.type === 'approval') {
 *     return (
 *       <div>
 *         <p>{request.prompt}</p>
 *         <button onClick={() => respond(request.id, 'approved')}>
 *           Approve
 *         </button>
 *         <button onClick={() => respond(request.id, 'rejected')}>
 *           Reject
 *         </button>
 *       </div>
 *     )
 *   }
 *
 *   // Handle other types...
 * }
 * ```
 */
export const useWorkflowHITL = (sessionId: string | null): WorkflowHITLResult => {
  const eventsQuery = useEventsQuery(sessionId)
  const sendMutation = useSendInputMutation()

  // Derive pending interactions from events
  const pending = useMemo((): ReadonlyArray<PendingInteraction> => {
    const events = eventsQuery.data ?? []
    const requests = new Map<EventId, PendingInteraction>()
    const responded = new Set<EventId>()

    for (const event of events) {
      if (event.name === EVENTS.INPUT_REQUESTED) {
        const payload = event.payload as {
          promptText: string
          inputType: "freeform" | "approval" | "choice"
          options?: ReadonlyArray<string>
        }
        requests.set(event.id, {
          id: event.id,
          prompt: payload.promptText,
          type: payload.inputType,
          // Only include options if defined (satisfies exactOptionalPropertyTypes)
          ...(payload.options !== undefined && { options: payload.options }),
          timestamp: event.timestamp
        })
      } else if (event.name === EVENTS.INPUT_RESPONSE) {
        // The causedBy field links response to request
        if (event.causedBy) {
          responded.add(event.causedBy)
        }
      }
    }

    // Return requests that haven't been responded to
    return Array.from(requests.values()).filter((r) => !responded.has(r.id))
  }, [eventsQuery.data])

  // Respond to an interaction
  const respond = useCallback(
    async (interactionId: EventId, response: string): Promise<void> => {
      // Generate event ID synchronously (Effect.runSync is safe for pure UUID generation)
      const eventId = Effect.runSync(makeEventId())

      const event: AnyEvent = {
        id: eventId,
        name: EVENTS.INPUT_RESPONSE,
        payload: { response },
        timestamp: new Date(),
        causedBy: interactionId
      }

      await sendMutation.mutateAsync({ event })
    },
    [sendMutation]
  )

  return {
    pending,
    respond,
    isResponding: sendMutation.isPending
  }
}
