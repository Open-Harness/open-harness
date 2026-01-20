/**
 * Tape Contracts - Public API Types
 *
 * These interfaces define the public API surface for the Tape.
 * Tape provides time-travel debugging with VCR-style controls.
 *
 * @module @core-v2/tape
 */

import type { AnyEvent, EventId } from "./event";

/**
 * Tape status - current playback state.
 */
export type TapeStatus = "idle" | "playing" | "paused" | "recording";

/**
 * Tape metadata for display/inspection.
 */
export interface TapeMetadata {
  /** Associated session ID */
  readonly sessionId: string;
  /** Total number of events */
  readonly eventCount: number;
  /** Duration from first to last event (milliseconds) */
  readonly duration?: number;
  /** Current status */
  readonly status: TapeStatus;
}

/**
 * Tape interface - time-travel debugging with VCR controls.
 *
 * @typeParam S - The workflow state type
 *
 * @remarks
 * The Tape is the core interface for:
 * - **Time-travel**: Step forward/backward through history
 * - **Inspection**: View state at any point
 * - **Playback**: Replay recorded sessions
 *
 * Key feature: `stepBack()` enables debugging by reversing through history.
 *
 * @example
 * ```typescript
 * // Load a recorded session
 * const tape = await workflow.load(sessionId);
 *
 * // Step through history
 * console.log(tape.position); // 0
 * const t1 = tape.step(); // Move to position 1
 * const t2 = t1.step(); // Move to position 2
 *
 * // Go back in time!
 * const t3 = t2.stepBack(); // Back to position 1
 * console.log(t3.state); // State at position 1
 *
 * // Jump to any position
 * const t4 = tape.stepTo(10);
 * console.log(t4.current); // Event at position 10
 *
 * // Play from current to end
 * const final = await tape.play();
 * ```
 */
export interface Tape<S = unknown> {
  // =========================================================================
  // Position & Length
  // =========================================================================

  /** Current event index (0-based) */
  readonly position: number;

  /** Total number of events */
  readonly length: number;

  // =========================================================================
  // Current State
  // =========================================================================

  /** Event at current position (undefined if empty) */
  readonly current: AnyEvent | undefined;

  /** Computed state at current position */
  readonly state: S;

  /** All events in the tape */
  readonly events: readonly AnyEvent[];

  // =========================================================================
  // Status Flags
  // =========================================================================

  /** Whether the tape is recording new events */
  readonly isRecording: boolean;

  /** Whether the tape is replaying recorded events */
  readonly isReplaying: boolean;

  /** Current playback status */
  readonly status: TapeStatus;

  // =========================================================================
  // VCR Controls (return new Tape - immutable)
  // =========================================================================

  /**
   * Rewind to position 0 (initial state).
   *
   * @returns New Tape at position 0
   */
  rewind(): Tape<S>;

  /**
   * Step forward one event.
   *
   * @remarks
   * At the last position, stays at last position.
   *
   * @returns New Tape at position + 1
   */
  step(): Tape<S>;

  /**
   * Step backward one event.
   *
   * @remarks
   * **THE key feature** - enables debugging by going back in time.
   * At position 0, stays at position 0.
   *
   * @returns New Tape at position - 1
   */
  stepBack(): Tape<S>;

  /**
   * Jump to a specific position.
   *
   * @remarks
   * Position is clamped to [0, length - 1].
   *
   * @param position - Target position (0-based)
   * @returns New Tape at the specified position
   */
  stepTo(position: number): Tape<S>;

  /**
   * Play from current position to end.
   *
   * @remarks
   * Async because it may involve timing/rendering.
   *
   * @returns Promise resolving to Tape at final position
   */
  play(): Promise<Tape<S>>;

  /**
   * Play from current position to a specific position.
   *
   * @param position - Target position to play to
   * @returns Promise resolving to Tape at target position
   */
  playTo(position: number): Promise<Tape<S>>;

  /**
   * Pause playback.
   *
   * @returns New Tape with status "paused"
   */
  pause(): Tape<S>;

  // =========================================================================
  // Inspection Methods
  // =========================================================================

  /**
   * Compute state at any position without changing current position.
   *
   * @param position - Position to compute state at
   * @returns State at that position
   */
  stateAt(position: number): S;

  /**
   * Get event at any position without changing current position.
   *
   * @param position - Position to get event from
   * @returns Event at that position, or undefined if out of bounds
   */
  eventAt(position: number): AnyEvent | undefined;
}

/**
 * Tape controls subset for React hook.
 *
 * @remarks
 * Exposes only the control methods without the data properties.
 */
export interface TapeControls<S = unknown> {
  rewind: () => void;
  step: () => void;
  stepBack: () => void;
  stepTo: (position: number) => void;
  play: () => Promise<void>;
  playTo: (position: number) => Promise<void>;
  pause: () => void;

  /** Current position for display */
  readonly position: number;
  /** Total length for display */
  readonly length: number;
  /** Current status for display */
  readonly status: TapeStatus;
}
