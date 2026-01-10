/**
 * Player - Step through recorded signals
 *
 * The Player provides VCR-like controls for navigating signal recordings:
 * - step(): Move forward one signal
 * - back(): Move backward one signal
 * - goto(index): Jump to specific index
 * - gotoCheckpoint(name): Jump to named checkpoint
 * - rewind(): Go back to start
 * - fastForward(): Go to end
 */

import type { Signal } from "@signals/core";
import { applySignal, createEmptySnapshot, type Snapshot, snapshot } from "./snapshot.js";
import type { Checkpoint, Recording } from "./store.js";

// ============================================================================
// Player Types
// ============================================================================

/**
 * Player position in the recording
 */
export interface PlayerPosition {
	/** Current index (-1 means before first signal) */
	readonly index: number;
	/** Total number of signals */
	readonly total: number;
	/** Current signal (undefined if before start or after end) */
	readonly current?: Signal;
	/** Is at the beginning? */
	readonly atStart: boolean;
	/** Is at the end? */
	readonly atEnd: boolean;
}

/**
 * Player state
 */
export interface PlayerState {
	/** Current position */
	readonly position: PlayerPosition;
	/** Snapshot at current position */
	readonly snapshot: Snapshot;
	/** Available checkpoints */
	readonly checkpoints: readonly Checkpoint[];
}

// ============================================================================
// Player Class
// ============================================================================

/**
 * Player - Navigate through recorded signals
 *
 * @example
 * ```ts
 * const player = new Player(recording);
 *
 * // Step through
 * while (!player.position.atEnd) {
 *   const signal = player.step();
 *   console.log(signal?.name, player.snapshot.provider.text.content);
 * }
 *
 * // Jump to checkpoint
 * player.gotoCheckpoint("after-analysis");
 *
 * // Rewind and replay
 * player.rewind();
 * ```
 */
export class Player {
	private readonly signals: readonly Signal[];
	private readonly checkpointMap: Map<string, Checkpoint>;
	private currentIndex: number;
	private currentSnapshot: Snapshot;

	constructor(
		recording: Recording,
		private readonly checkpoints: readonly Checkpoint[] = [],
	) {
		this.signals = recording.signals;
		this.checkpointMap = new Map(checkpoints.map((cp) => [cp.name, cp]));
		this.currentIndex = -1;
		this.currentSnapshot = createEmptySnapshot();
	}

	/**
	 * Create a player from signals directly
	 */
	static fromSignals(signals: readonly Signal[], checkpoints: readonly Checkpoint[] = []): Player {
		return new Player(
			{
				metadata: {
					id: "direct",
					createdAt: new Date().toISOString(),
					signalCount: signals.length,
				},
				signals,
			},
			checkpoints,
		);
	}

	/**
	 * Get current position
	 */
	get position(): PlayerPosition {
		return {
			index: this.currentIndex,
			total: this.signals.length,
			current:
				this.currentIndex >= 0 && this.currentIndex < this.signals.length ? this.signals[this.currentIndex] : undefined,
			atStart: this.currentIndex < 0,
			atEnd: this.currentIndex >= this.signals.length - 1,
		};
	}

	/**
	 * Get current snapshot
	 */
	get snapshot(): Snapshot {
		return this.currentSnapshot;
	}

	/**
	 * Get full state
	 */
	get state(): PlayerState {
		return {
			position: this.position,
			snapshot: this.snapshot,
			checkpoints: this.checkpoints,
		};
	}

	/**
	 * Step forward one signal
	 * @returns The signal stepped to, or undefined if at end
	 */
	step(): Signal | undefined {
		if (this.currentIndex >= this.signals.length - 1) {
			return undefined;
		}

		this.currentIndex++;
		const signal = this.signals[this.currentIndex];
		if (signal) {
			this.currentSnapshot = applySignal(this.currentSnapshot, signal, this.currentIndex);
		}

		return signal;
	}

	/**
	 * Step backward one signal
	 * @returns The signal stepped back from, or undefined if at start
	 */
	back(): Signal | undefined {
		if (this.currentIndex < 0) {
			return undefined;
		}

		const signal = this.signals[this.currentIndex];
		this.currentIndex--;

		// Recompute snapshot from start (snapshots aren't reversible)
		this.currentSnapshot = snapshot(this.signals, this.currentIndex);

		return signal;
	}

	/**
	 * Go to a specific index
	 * @param index - Target index (-1 for before start)
	 */
	goto(index: number): void {
		const targetIndex = Math.max(-1, Math.min(index, this.signals.length - 1));

		if (targetIndex === this.currentIndex) {
			return;
		}

		this.currentIndex = targetIndex;
		this.currentSnapshot = snapshot(this.signals, this.currentIndex);
	}

	/**
	 * Go to a named checkpoint
	 * @param name - Checkpoint name
	 * @returns true if checkpoint found, false otherwise
	 */
	gotoCheckpoint(name: string): boolean {
		const checkpoint = this.checkpointMap.get(name);
		if (!checkpoint) {
			return false;
		}

		this.goto(checkpoint.index);
		return true;
	}

	/**
	 * Go to the next signal matching a pattern
	 * @param pattern - Signal name pattern (supports *)
	 * @returns The signal found, or undefined if not found
	 */
	gotoNext(pattern: string): Signal | undefined {
		const regex = patternToRegex(pattern);

		for (let i = this.currentIndex + 1; i < this.signals.length; i++) {
			const signal = this.signals[i];
			if (signal && regex.test(signal.name)) {
				this.goto(i);
				return signal;
			}
		}

		return undefined;
	}

	/**
	 * Go to the previous signal matching a pattern
	 * @param pattern - Signal name pattern (supports *)
	 * @returns The signal found, or undefined if not found
	 */
	gotoPrevious(pattern: string): Signal | undefined {
		const regex = patternToRegex(pattern);

		for (let i = this.currentIndex - 1; i >= 0; i--) {
			const signal = this.signals[i];
			if (signal && regex.test(signal.name)) {
				this.goto(i);
				return signal;
			}
		}

		return undefined;
	}

	/**
	 * Rewind to start (before first signal)
	 */
	rewind(): void {
		this.currentIndex = -1;
		this.currentSnapshot = createEmptySnapshot();
	}

	/**
	 * Fast forward to end (last signal)
	 */
	fastForward(): void {
		this.goto(this.signals.length - 1);
	}

	/**
	 * Get signal at a specific index without moving
	 */
	peek(index: number): Signal | undefined {
		if (index < 0 || index >= this.signals.length) {
			return undefined;
		}
		return this.signals[index];
	}

	/**
	 * Get signals in a range without moving
	 */
	peekRange(start: number, end: number): Signal[] {
		const s = Math.max(0, start);
		const e = Math.min(this.signals.length, end);
		return this.signals.slice(s, e) as Signal[];
	}

	/**
	 * Find all signals matching a pattern
	 */
	findAll(pattern: string): Array<{ index: number; signal: Signal }> {
		const regex = patternToRegex(pattern);
		const matches: Array<{ index: number; signal: Signal }> = [];

		for (let i = 0; i < this.signals.length; i++) {
			const signal = this.signals[i];
			if (signal && regex.test(signal.name)) {
				matches.push({ index: i, signal });
			}
		}

		return matches;
	}
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a simple pattern to regex
 * Supports * as wildcard
 */
function patternToRegex(pattern: string): RegExp {
	// Escape special regex characters except *
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
	// Replace * with .* for wildcard matching
	const regexStr = escaped.replace(/\*/g, ".*");
	return new RegExp(`^${regexStr}$`);
}
