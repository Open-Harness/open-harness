/**
 * SignalAdapter - Interface for signal-to-output adapters
 *
 * Adapters receive signals and render them to different outputs (terminal, logs, web).
 * Unlike reporters, adapters:
 * - Focus on OUTPUT rendering with display metadata support
 * - Have explicit lifecycle methods (onStart/onStop) for setup/teardown
 * - Support async signal handlers for I/O-bound operations
 *
 * @example
 * ```ts
 * const terminalAdapter: SignalAdapter = {
 *   name: "terminal",
 *   patterns: ["*"],
 *   onStart: () => console.log("Starting terminal output..."),
 *   onSignal: (signal) => {
 *     const title = resolveTitle(signal);
 *     console.log(`[${signal.name}] ${title}`);
 *   },
 *   onStop: () => console.log("Terminal output complete."),
 * };
 * ```
 */

import type { Signal } from "@internal/signals-core";
import type { SignalPattern } from "./patterns.js";

/**
 * SignalAdapter interface for rendering signals to outputs.
 *
 * Adapters are the bridge between the signal system and output destinations.
 * They receive signals matching their patterns and render them appropriately.
 *
 * Key differences from SignalReporter:
 * - onSignal can be async (for I/O-bound operations like file writing)
 * - Explicit onStart/onStop lifecycle (not attach/detach semantics)
 * - Designed for OUTPUT rendering, not just observation
 */
export interface SignalAdapter {
	/**
	 * Human-readable name for the adapter (e.g., "terminal", "logs", "web")
	 */
	readonly name: string;

	/**
	 * Signal patterns this adapter subscribes to.
	 * Uses glob syntax: "*" for all, "plan:*", "task:**"
	 *
	 * Common patterns:
	 * - "*" - All signals (default for most adapters)
	 * - "plan:*" - All plan-related signals
	 * - "*:start" - All start signals
	 * - "*:complete" - All completion signals
	 */
	readonly patterns: SignalPattern[];

	/**
	 * Called for each signal matching the patterns.
	 * Can be sync or async - async handlers are awaited during emit.
	 *
	 * @param signal - The signal to render/process
	 */
	onSignal(signal: Signal): void | Promise<void>;

	/**
	 * Called when the adapter starts (before any signals are processed).
	 * Use for initialization: opening file handles, setting up terminal state, etc.
	 */
	onStart?(): void | Promise<void>;

	/**
	 * Called when the adapter stops (after all signals have been processed).
	 * Use for cleanup: flushing buffers, closing handles, printing summaries.
	 */
	onStop?(): void | Promise<void>;
}

/**
 * Configuration options for createAdapter()
 */
export interface CreateAdapterConfig {
	/**
	 * Human-readable name for the adapter
	 */
	name: string;

	/**
	 * Signal patterns to subscribe to.
	 * Defaults to ["*"] (all signals) if not specified.
	 */
	patterns?: SignalPattern[];

	/**
	 * Handler called for each matching signal.
	 * Can be sync or async.
	 */
	onSignal: (signal: Signal) => void | Promise<void>;

	/**
	 * Optional: Called when adapter starts
	 */
	onStart?: () => void | Promise<void>;

	/**
	 * Optional: Called when adapter stops
	 */
	onStop?: () => void | Promise<void>;
}

/**
 * Create a SignalAdapter from a configuration object.
 *
 * This is a convenience factory that provides sensible defaults:
 * - patterns defaults to ["*"] (subscribe to all signals)
 * - onStart/onStop are optional
 *
 * @param config - Adapter configuration
 * @returns A SignalAdapter instance
 *
 * @example
 * ```ts
 * // Minimal adapter - receives all signals
 * const logAdapter = createAdapter({
 *   name: "simple-log",
 *   onSignal: (signal) => console.log(signal.name),
 * });
 *
 * // Adapter with patterns and lifecycle
 * const taskAdapter = createAdapter({
 *   name: "task-tracker",
 *   patterns: ["task:*"],
 *   onStart: () => console.log("Tracking tasks..."),
 *   onSignal: (signal) => {
 *     console.log(`Task: ${signal.name}`, signal.payload);
 *   },
 *   onStop: () => console.log("Task tracking complete"),
 * });
 *
 * // Async adapter for file output
 * const fileAdapter = createAdapter({
 *   name: "file-writer",
 *   onSignal: async (signal) => {
 *     await appendFile("signals.log", JSON.stringify(signal) + "\n");
 *   },
 * });
 * ```
 */
export function createAdapter(config: CreateAdapterConfig): SignalAdapter {
	return {
		name: config.name,
		patterns: config.patterns ?? ["*"],
		onSignal: config.onSignal,
		onStart: config.onStart,
		onStop: config.onStop,
	};
}
