/**
 * WorkflowContext - React context for workflow state.
 *
 * @module
 */

import type { AnyEvent } from "@open-scaffold/core"
import { createContext } from "react"
import type { ConnectionStatus, ForkResult, PauseResult, ResumeResult, WorkflowClient } from "../Contract.js"

/**
 * Workflow context value.
 */
export interface WorkflowContextValue {
  /** The underlying client */
  readonly client: WorkflowClient | null
  /** Current session ID */
  readonly sessionId: string | null
  /** All received events */
  readonly events: ReadonlyArray<AnyEvent>
  /** Current computed state */
  readonly state: unknown
  /** Connection status */
  readonly status: ConnectionStatus
  /** Create a new session */
  readonly createSession: (input: string) => Promise<string>
  /** Connect to an existing session */
  readonly connectSession: (sessionId: string) => Promise<void>
  /** Send user input */
  readonly sendInput: (event: AnyEvent) => Promise<void>
  /** Disconnect from the current session */
  readonly disconnect: () => Promise<void>
  /** Pause the current session */
  readonly pause: () => Promise<PauseResult>
  /** Resume the current session */
  readonly resume: () => Promise<ResumeResult>
  /** Fork the current session */
  readonly fork: () => Promise<ForkResult>
  /** Whether the session is currently running */
  readonly isRunning: boolean
  /** Whether the session is currently paused (has events but not running) */
  readonly isPaused: boolean
}

/**
 * React context for workflow state and operations.
 */
export const WorkflowContext = createContext<WorkflowContextValue | null>(null)
