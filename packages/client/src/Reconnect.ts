/**
 * SSE reconnection schedule using Effect primitives.
 *
 * @module
 */

import { Duration, Schedule } from "effect"

/**
 * SSE reconnection schedule using Effect primitives:
 * - Exponential backoff starting at 100ms
 * - Jitter to prevent thundering herd
 * - Cap at 30 seconds max delay
 * - Max 20 reconnection attempts
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import { sseReconnectSchedule } from "@open-scaffold/client"
 *
 * const connectSSE = (sessionId: string) => pipe(
 *   establishSSEConnection(sessionId),
 *   Effect.retry(sseReconnectSchedule)
 * )
 * ```
 */
export const sseReconnectSchedule = Schedule.exponential(Duration.millis(100)).pipe(
  Schedule.jittered, // ±20% randomness
  Schedule.whileOutput((d) => Duration.lessThan(d, Duration.seconds(30))), // Cap max delay
  Schedule.compose(Schedule.recurs(20)) // Max 20 attempts
)
