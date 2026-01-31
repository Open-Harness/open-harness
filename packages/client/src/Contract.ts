/**
 * WorkflowClient contract - abstract interface for workflow clients.
 *
 * @module
 */

import type { SerializedEvent } from "@open-harness/core"

/**
 * Client error.
 */
export class ClientError extends Error {
  readonly operation: "connect" | "disconnect" | "send" | "receive"
  override readonly cause: unknown

  constructor(options: { operation: "connect" | "disconnect" | "send" | "receive"; cause: unknown }) {
    const message = options.cause instanceof Error
      ? options.cause.message
      : String(options.cause ?? "Unknown error")
    super(message)
    this.name = "ClientError"
    this.operation = options.operation
    this.cause = options.cause
  }
}

/**
 * Connection status for the client.
 */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error"

/**
 * Result of getStateAt operation.
 */
export interface StateAtResult<S> {
  /** The computed state at the requested position */
  readonly state: S
  /** The actual position used (may differ if requested position exceeds event count) */
  readonly position: number
  /** Number of events replayed to compute this state */
  readonly eventsReplayed: number
}

/**
 * Result of pause operation.
 */
export interface PauseResult {
  /** Whether the operation succeeded */
  readonly ok: boolean
  /** Whether the session was actually paused (false if already paused) */
  readonly wasPaused: boolean
}

/**
 * Result of resume operation.
 */
export interface ResumeResult {
  /** Whether the operation succeeded */
  readonly ok: boolean
  /** Whether the session was actually resumed (false if already running) */
  readonly wasResumed: boolean
}

/**
 * Result of fork operation.
 */
export interface ForkResult {
  /** The new session ID */
  readonly sessionId: string
  /** The original session ID */
  readonly originalSessionId: string
  /** Number of events copied to the new session */
  readonly eventsCopied: number
}

/**
 * Session info returned from getSession.
 */
export interface SessionInfo {
  /** The session ID */
  readonly sessionId: string
  /** Whether the session is currently running */
  readonly running: boolean
}

/**
 * Client configuration.
 */
export interface ClientConfig {
  readonly url: string
  readonly sessionId?: string
  readonly headers?: Record<string, string>
}

/**
 * Abstract workflow client interface.
 *
 * Implementations can use HTTP+SSE, WebSocket, or direct in-process calls.
 */
export interface WorkflowClient {
  /**
   * Create a new workflow session.
   * @returns The session ID
   */
  createSession(input: string): Promise<string>

  /**
   * Connect to an existing session.
   */
  connect(sessionId: string): Promise<void>

  /**
   * Get the event stream.
   * Must be connected first.
   */
  events(): AsyncIterable<SerializedEvent>

  /**
   * Get the current state.
   * Must be connected first.
   */
  getState<S>(): Promise<S>

  /**
   * Get the state at a specific position in the event history.
   * Enables time-travel debugging by replaying events up to the given position.
   * Must be connected first.
   *
   * @param position - The event position (0-indexed) to compute state at
   * @returns The computed state and metadata about the replay
   */
  getStateAt<S>(position: number): Promise<StateAtResult<S>>

  /**
   * Send user input event.
   * Must be connected first.
   */
  sendInput(event: SerializedEvent): Promise<void>

  /**
   * Disconnect from the session.
   */
  disconnect(): Promise<void>

  /**
   * Get session info including running state.
   * Must be connected first.
   */
  getSession(): Promise<SessionInfo>

  /**
   * Pause the current session.
   * Interrupts the workflow event loop.
   * Must be connected first.
   */
  pause(): Promise<PauseResult>

  /**
   * Resume the current session.
   * Restarts the workflow event loop from where it left off.
   * Must be connected first.
   */
  resume(): Promise<ResumeResult>

  /**
   * Fork the current session.
   * Creates a new session with all events copied.
   * Must be connected first.
   *
   * @returns The new session ID and metadata
   */
  fork(): Promise<ForkResult>

  /**
   * Get current connection status.
   */
  readonly status: ConnectionStatus
}
