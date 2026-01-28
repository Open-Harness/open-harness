/**
 * StateSnapshotStore service - persists state snapshots for efficient recovery.
 *
 * For workflows with many events (10,000+), snapshots avoid O(n) replay.
 * State is computed from: latest snapshot + events since snapshot.
 *
 * @module
 */

import type { Effect } from "effect"
import { Context } from "effect"

import type { StoreError } from "../Domain/Errors.js"
import type { SessionId } from "../Domain/Ids.js"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

/**
 * A snapshot of state at a specific event position.
 */
export interface StateSnapshot<S = unknown> {
  readonly sessionId: SessionId
  readonly state: S
  readonly position: number // Event index this state was computed at
  readonly createdAt: Date
}

// ─────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────

/**
 * Persistence layer for state snapshots.
 * Enables efficient state recovery for large event volumes.
 */
export interface StateSnapshotStoreService {
  /** Get latest snapshot for a session (null if none exists) */
  readonly getLatest: (
    sessionId: SessionId
  ) => Effect.Effect<StateSnapshot | null, StoreError>

  /** Save a snapshot */
  readonly save: (snapshot: StateSnapshot) => Effect.Effect<void, StoreError>

  /** Delete all snapshots for a session */
  readonly delete: (sessionId: SessionId) => Effect.Effect<void, StoreError>
}

// ─────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────

export class StateSnapshotStore extends Context.Tag("@open-scaffold/StateSnapshotStore")<
  StateSnapshotStore,
  StateSnapshotStoreService
>() {}
