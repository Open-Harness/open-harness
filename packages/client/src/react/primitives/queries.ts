/**
 * Primitive query hooks for React Query integration.
 *
 * Per ADR-013: Internal building blocks for the hooks layer.
 * These are NOT part of the public API.
 *
 * @internal
 * @module
 */

import type { AnyEvent } from "@open-scaffold/core"
import { useQuery } from "@tanstack/react-query"

import type { SessionInfo, StateAtResult } from "../../Contract.js"
import { useWorkflowClient } from "../WorkflowClientProvider.js"

/**
 * @internal
 * Query key factory for workflow queries.
 *
 * Provides consistent query key structure across all workflow queries.
 */
export const workflowKeys = {
  all: ["workflow"] as const,
  session: (sessionId: string | null) => ["workflow", "session", sessionId] as const,
  events: (sessionId: string | null) => ["workflow", "events", sessionId] as const,
  state: (sessionId: string | null, position: number) =>
    ["workflow", "state", sessionId, position] as const
}

/**
 * @internal
 * Query for session info.
 *
 * Fetches session metadata including running state.
 * Requires the client to already be connected to the session.
 *
 * @param sessionId - The session ID (used for query key and enable check)
 */
export const useSessionQuery = (sessionId: string | null) => {
  const { client } = useWorkflowClient()

  return useQuery<SessionInfo, Error>({
    queryKey: workflowKeys.session(sessionId),
    queryFn: () => client.getSession(),
    enabled: !!sessionId
  })
}

/**
 * @internal
 * Query for session events.
 *
 * Initially populated by SSE connection, this query serves as the
 * canonical store for events. The SSE subscription hook updates
 * this cache as new events arrive.
 *
 * staleTime is set to Infinity because:
 * 1. Initial data comes from SSE connection with history=true
 * 2. Updates come through SSE push, not polling
 * 3. The SSE subscription hook mutates this cache directly
 *
 * @param sessionId - The session ID (used for query key and enable check)
 */
export const useEventsQuery = (sessionId: string | null) => {
  return useQuery<ReadonlyArray<AnyEvent>, Error>({
    queryKey: workflowKeys.events(sessionId),
    // Initial data is empty - populated by SSE subscription
    queryFn: () => Promise.resolve([] as ReadonlyArray<AnyEvent>),
    enabled: !!sessionId,
    staleTime: Infinity // SSE keeps it fresh
  })
}

/**
 * @internal
 * Query for state at a specific position (server-side derivation).
 *
 * Enables time-travel debugging by requesting the server to replay
 * events up to the given position and return the computed state.
 *
 * @param sessionId - The session ID (used for query key and enable check)
 * @param position - The event position to compute state at
 */
export const useStateAtQuery = <S>(sessionId: string | null, position: number) => {
  const { client } = useWorkflowClient()

  return useQuery<StateAtResult<S>, Error>({
    queryKey: workflowKeys.state(sessionId, position),
    queryFn: () => client.getStateAt<S>(position),
    enabled: !!sessionId && position >= 0
  })
}
