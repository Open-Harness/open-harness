/**
 * Typed error definitions using Effect's Data.TaggedError.
 *
 * These errors are used internally. The public API converts them
 * to standard JavaScript Error instances.
 *
 * @module
 */

import { Data } from "effect"

/**
 * Workflow not found in registry.
 */
export class WorkflowNotFound extends Data.TaggedError("WorkflowNotFound")<{
  readonly workflowId: string
}> {}

/**
 * Session not found in store.
 */
export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{
  readonly sessionId: string
}> {}

/**
 * Store operation failed (read/write/delete).
 */
export class StoreError extends Data.TaggedError("StoreError")<{
  readonly operation: "read" | "write" | "delete"
  readonly cause: unknown
}> {}

/**
 * Agent execution failed.
 */
export class AgentError extends Data.TaggedError("AgentError")<{
  readonly agentName: string
  readonly phase: "prompt" | "execution" | "output"
  readonly cause: unknown
}> {}

/**
 * Provider (AgentProvider) error.
 */
export class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly code: "RATE_LIMITED" | "CONTEXT_EXCEEDED" | "AUTH_FAILED" | "NETWORK" | "UNKNOWN"
  readonly message: string
  readonly retryable: boolean
  readonly retryAfter?: number
}> {}

/**
 * Validation error (schema parse failure).
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
  readonly path?: string
}> {}

/**
 * Handler execution error (should not happen - handlers are pure).
 */
export class HandlerError extends Data.TaggedError("HandlerError")<{
  readonly handlerName: string
  readonly eventName: string
  readonly cause: unknown
}> {}

// ─────────────────────────────────────────────────────────────────
// Recording Errors
// ─────────────────────────────────────────────────────────────────

/**
 * Recording not found during playback mode.
 * Provider recorder does not have a recorded response for this request.
 */
export class RecordingNotFound extends Data.TaggedError("RecordingNotFound")<{
  readonly hash: string
  readonly prompt: string // First 100 chars for debugging
}> {}
