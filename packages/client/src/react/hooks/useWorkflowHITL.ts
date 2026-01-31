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

import { decodeInputReceivedPayload, decodeInputRequestedPayload, EVENTS, makeEventId } from "@open-scaffold/core"
import type { SerializedEvent } from "@open-scaffold/core"
import { Effect, Option } from "effect"

import { useEventsQuery, useSendInputMutation } from "../primitives/index.js"

/**
 * A pending human input request.
 * Per ADR-008: Uses payload.id as the correlation ID (not event.id).
 */
export interface PendingInteraction {
  /** Correlation ID for matching request to response (payload.id per ADR-008) */
  readonly id: string
  /** The prompt text shown to the user */
  readonly prompt: string
  /** Type of input requested */
  readonly type: "approval" | "choice"
  /** Available options for choice type */
  readonly options?: ReadonlyArray<string>
  /** When the request was made (Unix ms) */
  readonly timestamp: number
}

/**
 * Result from useWorkflowHITL hook.
 */
export interface WorkflowHITLResult {
  /** List of pending input requests awaiting response */
  readonly pending: ReadonlyArray<PendingInteraction>

  /**
   * Respond to a pending interaction.
   * @param interactionId - The correlation ID from the request (payload.id per ADR-008)
   * @param response - The user's response text
   */
  readonly respond: (interactionId: string, response: string) => Promise<void>

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

  // Derive pending interactions from events using ADR-008 canonical format
  // Uses Effect Schema validation internally - silently skips malformed events
  const pending = useMemo((): ReadonlyArray<PendingInteraction> => {
    const events = eventsQuery.data ?? []
    const requests = new Map<string, PendingInteraction>()
    const responded = new Set<string>()

    for (const event of events) {
      if (event.name === EVENTS.INPUT_REQUESTED) {
        // Type-safe parsing via Effect Schema (returns Option, not Effect)
        const parsed = decodeInputRequestedPayload(event.payload)
        if (Option.isSome(parsed)) {
          const payload = parsed.value
          requests.set(payload.id, {
            id: payload.id,
            prompt: payload.prompt,
            type: payload.type,
            // Only include options if defined (satisfies exactOptionalPropertyTypes)
            ...(payload.options !== undefined && { options: payload.options }),
            timestamp: event.timestamp
          })
        }
        // Malformed events are silently skipped (Option.isNone case)
      } else if (event.name === EVENTS.INPUT_RECEIVED) {
        // Type-safe parsing - correlation via payload.id per ADR-008
        const parsed = decodeInputReceivedPayload(event.payload)
        if (Option.isSome(parsed)) {
          responded.add(parsed.value.id)
        }
      }
    }

    // Return requests that haven't been responded to
    return Array.from(requests.values()).filter((r) => !responded.has(r.id))
  }, [eventsQuery.data])

  // Respond to an interaction using ADR-008 canonical format
  const respond = useCallback(
    async (interactionId: string, response: string): Promise<void> => {
      // Generate event ID synchronously (Effect.runSync is safe for pure UUID generation)
      const eventId = Effect.runSync(makeEventId())

      // Build SerializedEvent with ADR-008 canonical payload format
      // Correlation happens via payload.id, not causedBy
      const event: SerializedEvent = {
        id: eventId,
        name: EVENTS.INPUT_RECEIVED,
        payload: {
          id: interactionId, // Correlation ID per ADR-008
          value: response
        },
        timestamp: Date.now()
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
