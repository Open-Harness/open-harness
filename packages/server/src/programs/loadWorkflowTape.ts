/**
 * loadWorkflowTape - Workflow tape loading utility.
 *
 * The main entry point for running workflows is now `executeWorkflow`
 * from `@open-scaffold/core`. This module provides `loadWorkflowTape`
 * for debugging, replay, and time-travel.
 *
 * @module
 */

import { Effect } from "effect"

import {
  type AnyEvent,
  computeStateAt,
  type Services,
  type SessionId,
  type SessionNotFound,
  type StoreError
} from "@open-scaffold/core"

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
 * `state:updated` event — no handlers parameter needed.
 */
export const loadWorkflowTape = <S>(
  sessionId: SessionId,
  initialState: S
): Effect.Effect<
  { events: ReadonlyArray<AnyEvent>; state: S },
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
