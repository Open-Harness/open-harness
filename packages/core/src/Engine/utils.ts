/**
 * Utility functions for the Next runtime.
 *
 * Pure functions that operate on event data without services.
 *
 * @module
 */

import { EVENTS } from "./types.js"

/**
 * Minimal event shape required by computeStateAt.
 * Both AnyEvent (Next) and AnyInteractionEvent (Domain) satisfy this.
 */
interface EventLike {
  readonly name: string
  readonly payload: unknown
}

/**
 * Compute state at a specific position by scanning backwards for the
 * most recent `state:updated` event.
 *
 * This is a PURE function: events in, state out. No Effect, no services.
 *
 * @param events - The event log to scan
 * @param position - The position (exclusive upper bound) to scan up to
 * @returns The state from the last `state:updated` event before position, or undefined
 */
export const computeStateAt = <S>(
  events: ReadonlyArray<EventLike>,
  position: number
): S | undefined => {
  for (let i = Math.min(position, events.length) - 1; i >= 0; i--) {
    if (events[i].name === EVENTS.STATE_UPDATED) {
      return (events[i].payload as Record<string, unknown>).state as S
    }
  }
  return undefined
}
