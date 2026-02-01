/**
 * Grouped hook for workflow actions.
 *
 * Per ADR-013: Composes mutation primitives for session creation and input sending.
 * This is part of the public API.
 *
 * @module
 */

import type { SerializedEvent } from "@open-harness/core"

import { useCreateSessionMutation, useSendInputMutation } from "../primitives/index.js"

/**
 * Result from useWorkflowActions hook.
 */
export interface WorkflowActionsResult {
  /**
   * Create a new workflow session.
   * @param input - Initial input for the workflow
   * @returns The new session ID
   */
  readonly create: (input: string) => Promise<string>

  /**
   * Send an input event to the current session.
   * @param event - The event to send (typically an input:received)
   */
  readonly send: (event: SerializedEvent) => Promise<void>

  /** Whether a session is being created */
  readonly isCreating: boolean

  /** Whether input is being sent */
  readonly isSending: boolean
}

/**
 * Hook for workflow actions like creating sessions and sending input.
 *
 * Wraps React Query mutations for session lifecycle operations.
 *
 * @returns Action functions and loading states
 *
 * @example
 * ```tsx
 * function WorkflowControls() {
 *   const { create, send, isCreating } = useWorkflowActions()
 *
 *   const handleStart = async () => {
 *     const sessionId = await create("Build a todo app")
 *     // Navigate to session view
 *   }
 *
 *   return (
 *     <button onClick={handleStart} disabled={isCreating}>
 *       {isCreating ? 'Starting...' : 'Start Workflow'}
 *     </button>
 *   )
 * }
 * ```
 */
export const useWorkflowActions = (): WorkflowActionsResult => {
  const createMutation = useCreateSessionMutation()
  const sendMutation = useSendInputMutation()

  return {
    create: (input) => createMutation.mutateAsync({ input }),
    send: (event) => sendMutation.mutateAsync({ event }),
    isCreating: createMutation.isPending,
    isSending: sendMutation.isPending
  }
}
