/**
 * Utility functions for the Next runtime.
 *
 * Pure functions that operate on event data without services.
 *
 * @module
 */

import type { StateCheckpoint, StateIntent, WorkflowEvent } from "../Domain/Events.js"
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

// ═══════════════════════════════════════════════════════════════
// State Derivation Functions (ADR-006: Event Sourcing)
// ═══════════════════════════════════════════════════════════════

/**
 * Union type for events that can be used with deriveState.
 * Supports both:
 * - New format: WorkflowEvent (Data.TaggedClass with _tag)
 * - Old format: AnyEvent (name + payload)
 *
 * This enables backward compatibility during the migration period
 * described in ADR-006 Phase 2 (Dual-write).
 */
type DeriveableEvent = WorkflowEvent | EventLike

/**
 * Type guard for new-style WorkflowEvent (has _tag field).
 */
const isWorkflowEvent = (event: DeriveableEvent): event is WorkflowEvent =>
  "_tag" in event && typeof (event as WorkflowEvent)._tag === "string"

/**
 * Derive state by applying events to initial state.
 * Events should be in chronological order.
 *
 * Per ADR-006: This is the core state derivation function for event sourcing.
 * State is always derived from events, never mutated directly.
 *
 * Supports both event formats for backward compatibility:
 * - New format: WorkflowEvent with _tag (StateIntent, StateCheckpoint)
 * - Old format: AnyEvent with name (state:updated)
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
  events: ReadonlyArray<DeriveableEvent>,
  initial: S
): S => {
  let state = initial

  for (const event of events) {
    if (isWorkflowEvent(event)) {
      // New format: Data.TaggedClass with _tag
      if (event._tag === "StateIntent") {
        // Apply state from intent (contains full state)
        state = (event as StateIntent).state as S
      } else if (event._tag === "StateCheckpoint") {
        // Set state directly from checkpoint
        state = (event as StateCheckpoint).state as S
      }
    } else {
      // Old format: AnyEvent with name + payload
      if (event.name === EVENTS.STATE_UPDATED) {
        const payload = event.payload as Record<string, unknown>
        if (payload.state !== undefined) {
          state = payload.state as S
        }
      }
    }
    // Other events don't affect state derivation
  }

  return state
}

/**
 * Optimized version that finds last checkpoint first.
 * More efficient for long event sequences.
 *
 * Per ADR-006: Checkpoints are snapshots of state at strategic points
 * (phase boundaries, after N events, on pause). Starting from the last
 * checkpoint avoids replaying the entire event history.
 *
 * Supports both event formats for backward compatibility:
 * - New format: WorkflowEvent with _tag (StateIntent, StateCheckpoint)
 * - Old format: AnyEvent with name (state:updated)
 *
 * @param events - The workflow events to apply (chronological order)
 * @param initial - The initial state to start from
 * @returns The derived state after applying events from last checkpoint
 *
 * @example
 * ```typescript
 * // With 10,000 events and a checkpoint at position 9,500:
 * // Only processes 500 events instead of 10,000
 * const state = deriveStateOptimized(events, { count: 0 })
 * ```
 */
export const deriveStateOptimized = <S>(
  events: ReadonlyArray<DeriveableEvent>,
  initial: S
): S => {
  // Find last checkpoint (if any) - only in new-style events
  let lastCheckpointIndex = -1
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (isWorkflowEvent(event) && event._tag === "StateCheckpoint") {
      lastCheckpointIndex = i
      break
    }
  }

  // Start from checkpoint or initial
  let state = lastCheckpointIndex >= 0
    ? ((events[lastCheckpointIndex] as WorkflowEvent) as StateCheckpoint).state as S
    : initial

  // Apply events after checkpoint
  const startIndex = lastCheckpointIndex + 1
  for (let i = startIndex; i < events.length; i++) {
    const event = events[i]
    if (isWorkflowEvent(event)) {
      // New format
      if (event._tag === "StateIntent") {
        state = (event as StateIntent).state as S
      } else if (event._tag === "StateCheckpoint") {
        state = (event as StateCheckpoint).state as S
      }
    } else {
      // Old format
      if (event.name === EVENTS.STATE_UPDATED) {
        const payload = event.payload as Record<string, unknown>
        if (payload.state !== undefined) {
          state = payload.state as S
        }
      }
    }
  }

  return state
}
