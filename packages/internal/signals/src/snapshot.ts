/**
 * Snapshot - Derived state from signals
 *
 * Snapshots are point-in-time views of system state, derived from signals.
 * They enable:
 * - Debugging: See state at any point
 * - Testing: Assert on accumulated state
 * - Visualization: Show progression over time
 */

import type { Signal } from "@internal/signals-core";

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * Accumulated text content from text signals
 */
export interface TextAccumulator {
	/** Full accumulated text */
	readonly content: string;
	/** Number of deltas received */
	readonly deltaCount: number;
}

/**
 * Tool call state
 */
export interface ToolCallState {
	readonly id: string;
	readonly name: string;
	readonly input: unknown;
	readonly result?: unknown;
	readonly error?: string;
	readonly status: "pending" | "complete" | "error";
}

/**
 * Provider state at a point in time
 */
export interface ProviderState {
	/** Is provider currently running? */
	readonly running: boolean;
	/** Accumulated text output */
	readonly text: TextAccumulator;
	/** Accumulated thinking output (if any) */
	readonly thinking: TextAccumulator;
	/** Tool calls in progress or completed */
	readonly toolCalls: Map<string, ToolCallState>;
	/** Last error (if any) */
	readonly lastError?: { code: string; message: string };
}

/**
 * Snapshot - Point-in-time state derived from signals
 *
 * A snapshot represents the accumulated state at a specific signal index.
 * It's computed by reducing signals up to that point.
 */
export interface Snapshot {
	/** Signal index this snapshot is at */
	readonly atIndex: number;
	/** Timestamp of the signal at this index */
	readonly timestamp: string;
	/** Provider state */
	readonly provider: ProviderState;
	/** Custom state accumulated from user signals */
	readonly custom: Map<string, unknown>;
	/** Signal counts by type */
	readonly signalCounts: Map<string, number>;
}

// ============================================================================
// Snapshot Creation
// ============================================================================

/**
 * Create an empty snapshot
 */
export function createEmptySnapshot(): Snapshot {
	return {
		atIndex: -1,
		timestamp: new Date().toISOString(),
		provider: {
			running: false,
			text: { content: "", deltaCount: 0 },
			thinking: { content: "", deltaCount: 0 },
			toolCalls: new Map(),
			lastError: undefined,
		},
		custom: new Map(),
		signalCounts: new Map(),
	};
}

/**
 * Apply a signal to a snapshot, returning a new snapshot
 *
 * This is the core reducer for building snapshots from signals.
 */
export function applySignal(snapshot: Snapshot, signal: Signal, index: number): Snapshot {
	// Increment signal count
	const signalCounts = new Map(snapshot.signalCounts);
	signalCounts.set(signal.name, (signalCounts.get(signal.name) ?? 0) + 1);

	// Start with base snapshot updates
	let provider = snapshot.provider;
	const custom = new Map(snapshot.custom);

	// Handle provider signals
	switch (signal.name) {
		case "provider:start":
			provider = {
				...provider,
				running: true,
				text: { content: "", deltaCount: 0 },
				thinking: { content: "", deltaCount: 0 },
				toolCalls: new Map(),
				lastError: undefined,
			};
			break;

		case "provider:end":
			provider = { ...provider, running: false };
			break;

		case "provider:error": {
			const payload = signal.payload as { code: string; message: string };
			provider = { ...provider, lastError: payload };
			break;
		}

		case "text:delta": {
			const payload = signal.payload as { content: string };
			provider = {
				...provider,
				text: {
					content: provider.text.content + payload.content,
					deltaCount: provider.text.deltaCount + 1,
				},
			};
			break;
		}

		case "text:complete": {
			const payload = signal.payload as { content: string };
			provider = {
				...provider,
				text: {
					content: payload.content,
					deltaCount: provider.text.deltaCount,
				},
			};
			break;
		}

		case "thinking:delta": {
			const payload = signal.payload as { content: string };
			provider = {
				...provider,
				thinking: {
					content: provider.thinking.content + payload.content,
					deltaCount: provider.thinking.deltaCount + 1,
				},
			};
			break;
		}

		case "thinking:complete": {
			const payload = signal.payload as { content: string };
			provider = {
				...provider,
				thinking: {
					content: payload.content,
					deltaCount: provider.thinking.deltaCount,
				},
			};
			break;
		}

		case "tool:call": {
			const payload = signal.payload as { id: string; name: string; input: unknown };
			const toolCalls = new Map(provider.toolCalls);
			toolCalls.set(payload.id, {
				id: payload.id,
				name: payload.name,
				input: payload.input,
				status: "pending",
			});
			provider = { ...provider, toolCalls };
			break;
		}

		case "tool:result": {
			const payload = signal.payload as {
				id: string;
				name: string;
				result: unknown;
				error?: string;
			};
			const toolCalls = new Map(provider.toolCalls);
			const existing = toolCalls.get(payload.id);
			if (existing) {
				toolCalls.set(payload.id, {
					...existing,
					result: payload.result,
					error: payload.error,
					status: payload.error ? "error" : "complete",
				});
			}
			provider = { ...provider, toolCalls };
			break;
		}

		default:
			// Store custom signals in the custom map
			if (
				!signal.name.startsWith("provider:") &&
				!signal.name.startsWith("text:") &&
				!signal.name.startsWith("thinking:") &&
				!signal.name.startsWith("tool:")
			) {
				custom.set(signal.name, signal.payload);
			}
	}

	return {
		atIndex: index,
		timestamp: signal.timestamp,
		provider,
		custom,
		signalCounts,
	};
}

/**
 * Create a snapshot from signals at a specific index
 *
 * @param signals - Array of signals
 * @param atIndex - Index to snapshot at (default: last signal)
 * @returns Snapshot at the specified index
 *
 * @example
 * ```ts
 * const signals = recording.signals;
 *
 * // Snapshot at end
 * const final = snapshot(signals);
 *
 * // Snapshot at specific point
 * const atStep5 = snapshot(signals, 5);
 * ```
 */
export function snapshot(signals: readonly Signal[], atIndex?: number): Snapshot {
	const targetIndex = atIndex ?? signals.length - 1;

	if (targetIndex < 0 || signals.length === 0) {
		return createEmptySnapshot();
	}

	let current = createEmptySnapshot();

	for (let i = 0; i <= Math.min(targetIndex, signals.length - 1); i++) {
		const signal = signals[i];
		if (signal) {
			current = applySignal(current, signal, i);
		}
	}

	return current;
}

/**
 * Create snapshots at every signal (for visualization/debugging)
 *
 * @param signals - Array of signals
 * @returns Array of snapshots, one per signal
 */
export function snapshotAll(signals: readonly Signal[]): Snapshot[] {
	const snapshots: Snapshot[] = [];
	let current = createEmptySnapshot();

	for (let i = 0; i < signals.length; i++) {
		const signal = signals[i];
		if (signal) {
			current = applySignal(current, signal, i);
			snapshots.push(current);
		}
	}

	return snapshots;
}
