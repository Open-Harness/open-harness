/**
 * Tape - Time-Travel Debugging System
 *
 * The Tape is the core interface for time-travel debugging, providing
 * VCR-style controls to step forward, backward, and jump to any position
 * in a recorded event stream.
 *
 * Key feature: `stepBack()` enables debugging by reversing through history.
 *
 * @module @core-v2/tape
 */

import type { AnyEvent } from "../event/index.js";
import type { Handler, HandlerDefinition } from "../handler/index.js";

// ============================================================================
// Tape Status
// ============================================================================

/**
 * Tape status - current playback state.
 */
export type TapeStatus = "idle" | "playing" | "paused" | "recording";

// ============================================================================
// Tape Metadata
// ============================================================================

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

// ============================================================================
// Tape Interface
// ============================================================================

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
 * All control methods return NEW Tape instances (immutable pattern).
 * This aligns with React's re-render model and enables natural undo/redo.
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
	 * @returns New Tape at position + 1 (clamped to length-1)
	 */
	step(): Tape<S>;

	/**
	 * Step backward one event.
	 *
	 * @remarks
	 * **THE key feature** - enables debugging by going back in time.
	 * At position 0, stays at position 0.
	 *
	 * @returns New Tape at position - 1 (clamped to 0)
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

// ============================================================================
// Tape Controls (React Hook Subset)
// ============================================================================

/**
 * Tape controls subset for React hook.
 *
 * @remarks
 * Exposes only the control methods without the data properties.
 * Control methods return void because in React the state updates
 * trigger a re-render with the new tape state.
 *
 * @typeParam _S - The workflow state type (preserved for API consistency with Tape<S>)
 */
export interface TapeControls<_S = unknown> {
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

// ============================================================================
// Warning Callback
// ============================================================================

/**
 * Information about an unknown event encountered during replay.
 */
export interface UnknownEventWarning {
	/** The event that has no registered handler */
	readonly event: AnyEvent;
	/** The position of the event in the tape */
	readonly position: number;
	/** Human-readable message */
	readonly message: string;
}

/**
 * Callback invoked when an unknown event type is encountered during replay.
 * This allows consumers to log or handle unknown events as needed.
 */
export type OnUnknownEventCallback = (warning: UnknownEventWarning) => void;

// ============================================================================
// Tape Configuration
// ============================================================================

/**
 * Configuration options for creating a Tape.
 */
export interface TapeConfig<S> {
	/** All events in the tape */
	readonly events: readonly AnyEvent[];
	/** Registered handlers for state computation */
	readonly handlers: ReadonlyMap<string, Handler<AnyEvent, S>>;
	/** Initial state before any events */
	readonly initialState: S;
	/** Starting position (defaults to 0) */
	readonly position?: number;
	/** Initial status (defaults to "idle") */
	readonly status?: TapeStatus;
	/** Delay between events during play (ms, defaults to 0) */
	readonly playDelay?: number;
	/**
	 * Callback for unknown event types during replay.
	 * If not provided, a warning is logged to console.warn.
	 * Set to null to suppress warnings entirely.
	 */
	readonly onUnknownEvent?: OnUnknownEventCallback | null;
}

// ============================================================================
// State Computation Utility
// ============================================================================

/**
 * Options for computeState function.
 */
export interface ComputeStateOptions {
	/**
	 * Callback for unknown event types during replay.
	 * If not provided, a warning is logged to console.warn.
	 * Set to null to suppress warnings entirely.
	 */
	readonly onUnknownEvent?: OnUnknownEventCallback | null;
}

/**
 * Default warning callback that logs to console.warn.
 */
const defaultOnUnknownEvent: OnUnknownEventCallback = (warning) => {
	console.warn(warning.message);
};

/**
 * Computes state at a given position by replaying handlers from position 0.
 *
 * This is the core of event sourcing: state is derived by replaying
 * all events through their handlers up to the target position.
 *
 * Unknown event types (events with no registered handler) are skipped gracefully
 * with a warning. By default, warnings are logged to console.warn. You can provide
 * a custom callback or suppress warnings by passing null.
 *
 * @param events - All events in the tape
 * @param handlers - Map of event name to handler function
 * @param initialState - State before any events
 * @param toPosition - Target position (inclusive, -1 means no events applied)
 * @param options - Optional configuration for warning handling
 * @returns The computed state after replaying events [0, toPosition]
 *
 * @example
 * ```typescript
 * // State after events 0, 1, 2 (at position 2)
 * const state = computeState(events, handlers, initialState, 2);
 *
 * // Initial state (no events applied)
 * const initial = computeState(events, handlers, initialState, -1);
 *
 * // Custom warning handler
 * const state = computeState(events, handlers, initial, 10, {
 *   onUnknownEvent: (warning) => myLogger.warn(warning.message)
 * });
 *
 * // Suppress warnings
 * const state = computeState(events, handlers, initial, 10, {
 *   onUnknownEvent: null
 * });
 * ```
 */
export function computeState<S>(
	events: readonly AnyEvent[],
	handlers: ReadonlyMap<string, Handler<AnyEvent, S>>,
	initialState: S,
	toPosition: number,
	options?: ComputeStateOptions,
): S {
	// Clamp to valid range
	const endPos = Math.min(Math.max(-1, toPosition), events.length - 1);

	// If position is -1, return initial state (no events applied)
	if (endPos < 0) {
		return initialState;
	}

	// Determine warning callback:
	// - undefined: use default (console.warn)
	// - null: suppress warnings
	// - callback: use custom callback
	const onUnknownEvent = options?.onUnknownEvent === undefined ? defaultOnUnknownEvent : options.onUnknownEvent;

	// Replay handlers from 0 to endPos
	let state = initialState;
	for (let i = 0; i <= endPos; i++) {
		const event = events[i];
		if (!event) continue;

		const handler = handlers.get(event.name);
		if (handler) {
			const result = handler(event, state);
			state = result.state;
			// Note: emitted events are not processed during replay
			// They are already in the event log
		} else if (onUnknownEvent !== null) {
			// Unknown event type - skip gracefully with warning per spec edge cases
			onUnknownEvent({
				event,
				position: i,
				message: `Unknown event type "${event.name}" at position ${i} during replay - skipping gracefully`,
			});
		}
	}

	return state;
}

// ============================================================================
// Tape Implementation
// ============================================================================

/**
 * Internal Tape implementation class.
 *
 * This class is immutable - all control methods return NEW instances.
 */
class TapeImpl<S> implements Tape<S> {
	readonly position: number;
	readonly length: number;
	readonly events: readonly AnyEvent[];
	readonly status: TapeStatus;

	private readonly _handlers: ReadonlyMap<string, Handler<AnyEvent, S>>;
	private readonly _initialState: S;
	private readonly _playDelay: number;
	private readonly _onUnknownEvent: OnUnknownEventCallback | null | undefined;

	// Cached state to avoid recomputation
	private _cachedState: S | undefined;
	private _cachedStatePosition: number | undefined;

	constructor(config: TapeConfig<S>) {
		this.events = config.events;
		this._handlers = config.handlers;
		this._initialState = config.initialState;
		this._playDelay = config.playDelay ?? 0;
		this._onUnknownEvent = config.onUnknownEvent;

		// Position defaults to 0, clamped to valid range
		this.length = config.events.length;
		const maxPos = Math.max(0, this.length - 1);
		this.position = Math.max(0, Math.min(config.position ?? 0, maxPos));

		// Status defaults to idle
		this.status = config.status ?? "idle";
	}

	// =========================================================================
	// Current State
	// =========================================================================

	get current(): AnyEvent | undefined {
		return this.events[this.position];
	}

	get state(): S {
		// Use cached state if available for current position
		if (this._cachedState !== undefined && this._cachedStatePosition === this.position) {
			return this._cachedState;
		}

		// Compute and cache
		// Note: position is the index of the last processed event
		// So we compute state through position (inclusive)
		const computed = computeState(this.events, this._handlers, this._initialState, this.position, {
			onUnknownEvent: this._onUnknownEvent,
		});
		// TypeScript doesn't allow assigning to readonly properties, but we need caching
		// Use Object.assign to update the mutable cache fields
		Object.assign(this, { _cachedState: computed, _cachedStatePosition: this.position });

		return computed;
	}

	// =========================================================================
	// Status Flags
	// =========================================================================

	get isRecording(): boolean {
		return this.status === "recording";
	}

	get isReplaying(): boolean {
		return this.status === "playing" || this.status === "paused";
	}

	// =========================================================================
	// VCR Controls
	// =========================================================================

	rewind(): Tape<S> {
		return this._withPosition(0, "idle");
	}

	step(): Tape<S> {
		// Clamp at end
		const newPos = Math.min(this.position + 1, Math.max(0, this.length - 1));
		return this._withPosition(newPos);
	}

	stepBack(): Tape<S> {
		// Clamp at beginning
		const newPos = Math.max(0, this.position - 1);
		return this._withPosition(newPos);
	}

	stepTo(position: number): Tape<S> {
		// Clamp to valid range [0, length-1] (or 0 for empty tape)
		const maxPos = Math.max(0, this.length - 1);
		const clampedPos = Math.max(0, Math.min(position, maxPos));
		return this._withPosition(clampedPos);
	}

	async play(): Promise<Tape<S>> {
		return this.playTo(this.length - 1);
	}

	async playTo(position: number): Promise<Tape<S>> {
		// Clamp target position
		const maxPos = Math.max(0, this.length - 1);
		const targetPos = Math.max(0, Math.min(position, maxPos));

		// If already at or past target, just return tape at target
		if (this.position >= targetPos) {
			return this._withPosition(targetPos, "paused");
		}

		// Set status to playing
		let current: Tape<S> = this._withPosition(this.position, "playing");

		// Step through each position with optional delay
		for (let pos = this.position + 1; pos <= targetPos; pos++) {
			if (this._playDelay > 0) {
				await new Promise((resolve) => setTimeout(resolve, this._playDelay));
			}
			current = (current as TapeImpl<S>)._withPosition(pos, "playing");
		}

		// Return final position with paused status
		return (current as TapeImpl<S>)._withPosition(targetPos, "paused");
	}

	pause(): Tape<S> {
		return this._withPosition(this.position, "paused");
	}

	// =========================================================================
	// Inspection Methods
	// =========================================================================

	stateAt(position: number): S {
		// Clamp position
		const clampedPos = Math.max(-1, Math.min(position, this.length - 1));
		return computeState(this.events, this._handlers, this._initialState, clampedPos, {
			onUnknownEvent: this._onUnknownEvent,
		});
	}

	eventAt(position: number): AnyEvent | undefined {
		if (position < 0 || position >= this.length) {
			return undefined;
		}
		return this.events[position];
	}

	// =========================================================================
	// Internal Helpers
	// =========================================================================

	/**
	 * Creates a new Tape at a different position with optional status change.
	 */
	private _withPosition(newPosition: number, newStatus?: TapeStatus): Tape<S> {
		return new TapeImpl({
			events: this.events,
			handlers: this._handlers,
			initialState: this._initialState,
			position: newPosition,
			status: newStatus ?? this.status,
			playDelay: this._playDelay,
			onUnknownEvent: this._onUnknownEvent,
		});
	}
}

// ============================================================================
// Tape Factory
// ============================================================================

/**
 * Creates a new Tape from events and handlers.
 *
 * @param config - Tape configuration
 * @returns A new Tape instance
 *
 * @example
 * ```typescript
 * const handlers = new Map<string, Handler<AnyEvent, MyState>>();
 * handlers.set("user:input", userInputHandler);
 *
 * const tape = createTape({
 *   events: recordedEvents,
 *   handlers,
 *   initialState: { messages: [] },
 * });
 *
 * // Time-travel!
 * const t1 = tape.step();      // Forward
 * const t2 = t1.stepBack();    // Backward
 * const t3 = tape.stepTo(10);  // Jump
 * ```
 */
export function createTape<S>(config: TapeConfig<S>): Tape<S> {
	return new TapeImpl(config);
}

/**
 * Creates a Tape from an array of handler definitions.
 *
 * This is a convenience function that builds the handler map from definitions.
 *
 * @param events - All events in the tape
 * @param handlerDefs - Array of handler definitions
 * @param initialState - State before any events
 * @param options - Additional options
 * @returns A new Tape instance
 *
 * @example
 * ```typescript
 * const tape = createTapeFromDefinitions(
 *   recordedEvents,
 *   [userInputHandler, textDeltaHandler],
 *   { messages: [] }
 * );
 * ```
 */
export function createTapeFromDefinitions<S>(
	events: readonly AnyEvent[],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Allow handlers with specific event types
	handlerDefs: readonly HandlerDefinition<any, S>[],
	initialState: S,
	options?: {
		position?: number;
		status?: TapeStatus;
		playDelay?: number;
	},
): Tape<S> {
	// Build handler map from definitions
	const handlers = new Map<string, Handler<AnyEvent, S>>();
	for (const def of handlerDefs) {
		handlers.set(def.handles, def.handler as Handler<AnyEvent, S>);
	}

	return createTape({
		events,
		handlers,
		initialState,
		position: options?.position,
		status: options?.status,
		playDelay: options?.playDelay,
	});
}
