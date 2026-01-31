/**
 * loadWorkflowTape - Workflow tape loading utility.
 *
 * The main entry point for running workflows is now `executeWorkflow`
 * from `@open-harness/core`. This module provides `loadWorkflowTape`
 * for debugging, replay, and time-travel.
 *
 * @module
 */

import { Effect } from "effect"

import {
  computeStateAt,
  type SerializedEvent,
  type SessionId,
  type SessionNotFound,
  type StoreError
} from "@open-harness/core"
import type { Services } from "@open-harness/core/internal"

import { loadSession } from "./loadSession.js"

// ─────────────────────────────────────────────────────────────────
// loadWorkflowTape
// ─────────────────────────────────────────────────────────────────

/**
 * Load a workflow tape (events + computed state).
 *
 * For debugging, replay, and time-travel.
 *
 * `computeStateAt` is a pure function that scans for the last
 * state event (state:intent or state:checkpoint) — no handlers parameter needed.
 */
export const loadWorkflowTape = <S>(
  sessionId: SessionId,
  initialState: S
): Effect.Effect<
  { events: ReadonlyArray<SerializedEvent>; state: S },
  StoreError | SessionNotFound,
  Services.EventStore
> =>
  Effect.gen(function*() {
    const { events } = yield* loadSession(sessionId)
    const state = computeStateAt<S>(events, events.length) ?? initialState
    return { events, state }
  }).pipe(
    Effect.withSpan("loadWorkflowTape", {
      attributes: { sessionId }
    })
  )
