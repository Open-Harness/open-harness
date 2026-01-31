/**
 * Utility functions for the Next runtime.
 *
 * Pure functions that operate on event data without services.
 *
 * @module
 */

import { tagToEventName } from "../Domain/Events.js"

/**
 * Minimal event shape required for state derivation.
 * SerializedEvent and AnyEvent both satisfy this interface.
 */
interface EventLike {
  readonly name: string
  readonly payload: unknown
}

/**
 * Compute state at a specific position by scanning backwards for the
 * most recent state event (state:intent or state:checkpoint).
 *
 * This is a PURE function: events in, state out. No Effect, no services.
 *
 * @param events - The event log to scan
 * @param position - The position (exclusive upper bound) to scan up to
 * @returns The state from the last state event before position, or undefined
 */
export const computeStateAt = <S>(
  events: ReadonlyArray<EventLike>,
  position: number
): S | undefined => {
  for (let i = Math.min(position, events.length) - 1; i >= 0; i--) {
    const name = events[i].name
    // Look for state:intent or state:checkpoint (canonical names)
    if (name === tagToEventName.StateIntent || name === tagToEventName.StateCheckpoint) {
      return (events[i].payload as Record<string, unknown>).state as S
    }
  }
  return undefined
}

// ═══════════════════════════════════════════════════════════════
// State Derivation Functions (ADR-006: Event Sourcing)
// ═══════════════════════════════════════════════════════════════

/**
 * Derive state by applying events to initial state.
 * Events should be in chronological order.
 *
 * Per ADR-006: This is the core state derivation function for event sourcing.
 * State is always derived from events, never mutated directly.
 *
 * Looks for state:intent and state:checkpoint events (canonical names per ADR-008).
 *
 * @param events - The workflow events to apply (chronological order)
 * @param initial - The initial state to start from
 * @returns The derived state after applying all relevant events
 *
 * @example
 * ```typescript
 * const state = deriveState(events, { count: 0 })
 * ```
 */
export const deriveState = <S>(
  events: ReadonlyArray<EventLike>,
  initial: S
): S => {
  let state = initial

  for (const event of events) {
    const name = event.name
    if (name === tagToEventName.StateIntent || name === tagToEventName.StateCheckpoint) {
      const payload = event.payload as Record<string, unknown>
      if (payload.state !== undefined) {
        state = payload.state as S
      }
    }
    // Other events don't affect state derivation
  }

  return state
}
