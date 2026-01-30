/**
 * Unified workflow hook composing all grouped hooks.
 *
 * Per ADR-013 (Tier 2): This is the main PUBLIC API hook that provides
 * a single interface for all workflow operations including data access,
 * actions, VCR controls, and HITL interactions.
 *
 * @module
 */

import { useMemo } from "react"

import { EVENTS } from "@open-scaffold/core"
import type { AnyEvent, EventId } from "@open-scaffold/core"

import type { ForkResult, PauseResult, ResumeResult } from "../../Contract.js"
import { useWorkflowActions } from "./useWorkflowActions.js"
import type { WorkflowDataStatus } from "./useWorkflowData.js"
import { useWorkflowData } from "./useWorkflowData.js"
import type { PendingInteraction } from "./useWorkflowHITL.js"
import { useWorkflowHITL } from "./useWorkflowHITL.js"
import { useWorkflowVCR } from "./useWorkflowVCR.js"

/**
 * Result from the unified useWorkflow hook.
 *
 * @template S - The workflow state type
 */
export interface UseWorkflowResult<S> {
  // ─────────────────────────────────────────────────────────────────
  // Connection
  // ─────────────────────────────────────────────────────────────────

  /** Connection status */
  readonly status: WorkflowDataStatus
  /** Whether connected to a session */
  readonly isConnected: boolean

  // ─────────────────────────────────────────────────────────────────
  // Data
  // ─────────────────────────────────────────────────────────────────

  /** All events in the session */
  readonly events: ReadonlyArray<AnyEvent>
  /** Current state (derived at position) */
  readonly state: S | undefined
  /** Current event position (events.length) */
  readonly position: number

  // ─────────────────────────────────────────────────────────────────
  // Derived Status
  // ─────────────────────────────────────────────────────────────────

  /** Whether workflow has started and not yet completed */
  readonly isRunning: boolean
  /** Whether workflow is paused (pause events > resume events) */
  readonly isPaused: boolean
  /** Whether workflow has completed */
  readonly isCompleted: boolean

  // ─────────────────────────────────────────────────────────────────
  // HITL
  // ─────────────────────────────────────────────────────────────────

  /** Pending human input requests awaiting response */
  readonly pendingInteractions: ReadonlyArray<PendingInteraction>

  // ─────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────

  /**
   * Send a human input event.
   * Requires a connected session.
   *
   * @param event - The event to send (typically an input:response)
   * @throws Error if no session is connected
   */
  readonly send: (event: AnyEvent) => Promise<void>

  /**
   * Pause the current workflow session.
   * Requires a connected session.
   *
   * @returns Pause result with success status
   * @throws Error if no session is connected
   */
  readonly pause: () => Promise<PauseResult>

  /**
   * Resume a paused workflow session.
   * Requires a connected session.
   *
   * @returns Resume result with success status
   * @throws Error if no session is connected
   */
  readonly resume: () => Promise<ResumeResult>

  /**
   * Fork the current session into a new branch.
   * Requires a connected session.
   *
   * @returns Fork result with new session ID
   * @throws Error if no session is connected
   */
  readonly fork: () => Promise<ForkResult>

  /**
   * Respond to a pending HITL interaction.
   * Convenience wrapper around send that creates the proper event.
   * Requires a connected session.
   *
   * @param interactionId - The ID of the interaction to respond to
   * @param response - The user's response text
   * @throws Error if no session is connected
   */
  readonly respond: (interactionId: string, response: string) => Promise<void>

  // ─────────────────────────────────────────────────────────────────
  // Loading States
  // ─────────────────────────────────────────────────────────────────

  /** Whether data is loading */
  readonly isLoading: boolean
  /** Whether input is being sent */
  readonly isSending: boolean
  /** Whether pause is in progress */
  readonly isPausing: boolean
  /** Whether resume is in progress */
  readonly isResuming: boolean
  /** Whether fork is in progress */
  readonly isForking: boolean
  /** Whether HITL response is being sent */
  readonly isResponding: boolean

  // ─────────────────────────────────────────────────────────────────
  // Error
  // ─────────────────────────────────────────────────────────────────

  /** Error if any occurred */
  readonly error: Error | null
}

/**
 * Unified hook for workflow operations.
 *
 * Composes all grouped hooks (data, actions, VCR, HITL) into a single
 * interface. This is the recommended hook for most use cases.
 *
 * The hook derives workflow status from events:
 * - isRunning: workflow:started seen, workflow:completed not seen, not paused
 * - isPaused: pause events > resume events (when/if pause events exist)
 * - isCompleted: workflow:completed seen
 *
 * Actions throw if called without a connected session. Check `isConnected`
 * or `sessionId` before calling actions.
 *
 * @template S - The workflow state type
 * @param sessionId - The session to connect to (null disables)
 * @returns Unified workflow interface
 *
 * @example
 * ```tsx
 * function WorkflowView({ sessionId }: { sessionId: string }) {
 *   const {
 *     events, state, status,
 *     isRunning, isPaused, isCompleted,
 *     pendingInteractions,
 *     pause, resume, fork, respond,
 *     isLoading, error
 *   } = useWorkflow<MyState>(sessionId)
 *
 *   if (isLoading) return <Loading />
 *   if (error) return <Error error={error} />
 *
 *   return (
 *     <div>
 *       <StatusBar running={isRunning} paused={isPaused} completed={isCompleted} />
 *       <StateView state={state} />
 *       <EventLog events={events} />
 *
 *       {pendingInteractions.map(interaction => (
 *         <HITLPrompt
 *           key={interaction.id}
 *           interaction={interaction}
 *           onRespond={(value) => respond(interaction.id, value)}
 *         />
 *       ))}
 *
 *       <VCRControls
 *         isPaused={isPaused}
 *         onPause={pause}
 *         onResume={resume}
 *         onFork={fork}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */
export const useWorkflow = <S>(sessionId: string | null): UseWorkflowResult<S> => {
  const data = useWorkflowData<S>(sessionId)
  const actions = useWorkflowActions()
  const vcr = useWorkflowVCR()
  const hitl = useWorkflowHITL(sessionId)

  // Derive workflow status from events
  // Note: Events use `name` field with values like "workflow:started"
  const { isCompleted, isPaused, isRunning } = useMemo(() => {
    const events = data.events
    const hasStarted = events.some((e) => e.name === EVENTS.WORKFLOW_STARTED)
    const hasCompleted = events.some((e) => e.name === EVENTS.WORKFLOW_COMPLETED)

    // Count pause/resume events if they exist (future-proof)
    // Currently pause/resume are API operations, not events
    // But if they become events, this will handle them
    const pauseCount = events.filter((e) => e.name === "workflow:paused").length
    const resumeCount = events.filter((e) => e.name === "workflow:resumed").length
    const isPausedFromEvents = pauseCount > resumeCount

    return {
      isRunning: hasStarted && !hasCompleted && !isPausedFromEvents,
      isPaused: isPausedFromEvents,
      isCompleted: hasCompleted
    }
  }, [data.events])

  // Create session-bound action wrappers that throw if no session
  const assertSession = (): void => {
    if (!sessionId) {
      throw new Error("No session connected. Provide a sessionId to useWorkflow.")
    }
  }

  return {
    // Connection
    status: data.status,
    isConnected: data.status === "connected",

    // Data
    events: data.events,
    state: data.state,
    position: data.position,

    // Derived
    isRunning,
    isPaused,
    isCompleted,

    // HITL
    pendingInteractions: hitl.pending,

    // Actions (all require connected session)
    send: async (event) => {
      assertSession()
      return actions.send(event)
    },
    pause: async () => {
      assertSession()
      return vcr.pause()
    },
    resume: async () => {
      assertSession()
      return vcr.resume()
    },
    fork: async () => {
      assertSession()
      return vcr.fork()
    },
    respond: async (interactionId, response) => {
      assertSession()
      // Cast to EventId - the public API accepts string for ergonomics
      return hitl.respond(interactionId as EventId, response)
    },

    // Loading
    isLoading: data.isLoading,
    isSending: actions.isSending,
    isPausing: vcr.isPausing,
    isResuming: vcr.isResuming,
    isForking: vcr.isForking,
    isResponding: hitl.isResponding,

    // Error
    error: data.error
  }
}
