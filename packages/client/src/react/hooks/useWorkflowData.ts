/**
 * Grouped hook for workflow data access.
 *
 * Per ADR-013: Composes primitive hooks for events, state, and connection status.
 * This is part of the public API.
 *
 * @module
 */

import { useMemo } from "react"

import type { SerializedEvent } from "@open-scaffold/core"

import { useEventsQuery, useEventSubscription, useStateAtQuery } from "../primitives/index.js"

/**
 * Connection status for workflow data.
 */
export type WorkflowDataStatus = "connecting" | "connected" | "disconnected" | "error"

/**
 * Result from useWorkflowData hook.
 *
 * @template S - The workflow state type
 */
export interface WorkflowDataResult<S> {
  /** All events in the session */
  readonly events: ReadonlyArray<SerializedEvent>
  /** Current state (derived at position) */
  readonly state: S | undefined
  /** Current event position (events.length) */
  readonly position: number
  /** Connection status */
  readonly status: WorkflowDataStatus
  /** Whether data is currently loading */
  readonly isLoading: boolean
  /** Error if any occurred */
  readonly error: Error | null
}

/**
 * Hook for accessing workflow data including events, state, and connection status.
 *
 * Subscribes to SSE events and keeps the React Query cache up to date.
 * State is derived server-side at the current position.
 *
 * @template S - The workflow state type
 * @param sessionId - The session to connect to (null disables)
 * @returns Workflow data including events, state, position, and status
 *
 * @example
 * ```tsx
 * function WorkflowView({ sessionId }: { sessionId: string }) {
 *   const { events, state, status, isLoading } = useWorkflowData<MyState>(sessionId)
 *
 *   if (isLoading) return <Loading />
 *   if (status === 'error') return <Error />
 *
 *   return (
 *     <div>
 *       <StateView state={state} />
 *       <EventLog events={events} />
 *     </div>
 *   )
 * }
 * ```
 */
export const useWorkflowData = <S>(sessionId: string | null): WorkflowDataResult<S> => {
  // Subscribe to SSE events - updates React Query cache
  useEventSubscription(sessionId)

  // Query for events (populated by SSE subscription)
  const eventsQuery = useEventsQuery(sessionId)
  const events = eventsQuery.data ?? []
  const position = events.length

  // Query for state at current position
  const stateQuery = useStateAtQuery<S>(sessionId, position)

  // Derive connection status from query states
  const status = useMemo((): WorkflowDataStatus => {
    if (!sessionId) return "disconnected"
    if (eventsQuery.isLoading) return "connecting"
    if (eventsQuery.isError) return "error"
    return "connected"
  }, [sessionId, eventsQuery.isLoading, eventsQuery.isError])

  return {
    events,
    state: stateQuery.data?.state,
    position,
    status,
    isLoading: eventsQuery.isLoading || stateQuery.isLoading,
    error: eventsQuery.error ?? stateQuery.error ?? null
  }
}
