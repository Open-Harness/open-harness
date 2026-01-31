/**
 * Grouped hook for VCR-style workflow controls.
 *
 * Per ADR-013: Composes mutation primitives for pause, resume, and fork operations.
 * Enables time-travel debugging and session branching.
 * This is part of the public API.
 *
 * @module
 */

import type { ForkResult, PauseResult, ResumeResult } from "../../Contract.js"
import { useForkMutation, usePauseMutation, useResumeMutation } from "../primitives/index.js"

/**
 * Result from useWorkflowVCR hook.
 */
export interface WorkflowVCRResult {
  /**
   * Pause the current workflow session.
   * Interrupts the event loop until resumed.
   * @returns Pause result with success status
   */
  readonly pause: () => Promise<PauseResult>

  /**
   * Resume a paused workflow session.
   * Restarts the event loop from where it left off.
   * @returns Resume result with success status
   */
  readonly resume: () => Promise<ResumeResult>

  /**
   * Fork the current session into a new branch.
   * Creates a copy with all events for alternative exploration.
   * @returns Fork result with new session ID
   */
  readonly fork: () => Promise<ForkResult>

  /** Whether pause is in progress */
  readonly isPausing: boolean

  /** Whether resume is in progress */
  readonly isResuming: boolean

  /** Whether fork is in progress */
  readonly isForking: boolean
}

/**
 * Hook for VCR-style workflow controls: pause, resume, and fork.
 *
 * These operations enable:
 * - Pausing execution to inspect state
 * - Resuming from where you left off
 * - Forking to explore alternative paths
 *
 * @returns VCR control functions and loading states
 *
 * @example
 * ```tsx
 * function VCRControls({ isPaused }: { isPaused: boolean }) {
 *   const { pause, resume, fork, isPausing, isResuming } = useWorkflowVCR()
 *
 *   return (
 *     <div>
 *       {isPaused ? (
 *         <button onClick={resume} disabled={isResuming}>
 *           Resume
 *         </button>
 *       ) : (
 *         <button onClick={pause} disabled={isPausing}>
 *           Pause
 *         </button>
 *       )}
 *       <button onClick={fork}>
 *         Fork Session
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export const useWorkflowVCR = (): WorkflowVCRResult => {
  const pauseMutation = usePauseMutation()
  const resumeMutation = useResumeMutation()
  const forkMutation = useForkMutation()

  return {
    pause: () => pauseMutation.mutateAsync(),
    resume: () => resumeMutation.mutateAsync(),
    fork: () => forkMutation.mutateAsync(),
    isPausing: pauseMutation.isPending,
    isResuming: resumeMutation.isPending,
    isForking: forkMutation.isPending
  }
}
