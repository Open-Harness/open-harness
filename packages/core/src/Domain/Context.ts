/**
 * SessionContext - Ambient context available within workflow execution.
 *
 * Uses FiberRef for automatic propagation through the fiber tree.
 * Set once at workflow entry point, available everywhere.
 *
 * @module
 */

import { Effect, FiberRef } from "effect"

import type { SessionId } from "./Ids.js"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

/**
 * Session context available to all Effects within a workflow run.
 * Set at workflow entry point, automatically propagated to all nested effects.
 */
export interface SessionContext {
  readonly sessionId: SessionId
  /** Short workflow name per ADR-008 */
  readonly workflow: string
}

// ─────────────────────────────────────────────────────────────────
// FiberRef
// ─────────────────────────────────────────────────────────────────

/**
 * FiberRef holding the current session context.
 * Null when not inside a workflow execution.
 */
export const SessionContextRef = FiberRef.unsafeMake<SessionContext | null>(null)

// ─────────────────────────────────────────────────────────────────
// Accessors
// ─────────────────────────────────────────────────────────────────

/**
 * Get current session context.
 *
 * Returns the context if inside a workflow, or fails with a descriptive error.
 * Use this in programs that need sessionId for logging/tracing.
 */
export const getSessionContext: Effect.Effect<SessionContext, never, never> = Effect.gen(
  function*() {
    const ctx = yield* FiberRef.get(SessionContextRef)
    if (!ctx) {
      return yield* Effect.die("SessionContext not set - are you inside a workflow?")
    }
    return ctx
  }
)

/**
 * Get current session context, or null if not in a workflow.
 *
 * Use this when you want to optionally include session context but not fail.
 */
export const getSessionContextOptional: Effect.Effect<SessionContext | null, never, never> = FiberRef.get(
  SessionContextRef
)

// ─────────────────────────────────────────────────────────────────
// Combinators
// ─────────────────────────────────────────────────────────────────

/**
 * Run an effect with session context.
 *
 * Sets the SessionContext FiberRef for the duration of the effect.
 * All nested effects will have access to this context automatically.
 *
 * @example
 * ```ts
 * const result = yield* withSessionContext(
 *   { sessionId, workflow: "my-workflow" },
 *   executeWorkflow(config)
 * )
 * ```
 */
export const withSessionContext = <A, E, R>(
  context: SessionContext,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => Effect.locally(effect, SessionContextRef, context)
