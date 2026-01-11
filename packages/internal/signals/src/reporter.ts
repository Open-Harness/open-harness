/**
 * SignalReporter - Interface for signal-based reporters
 *
 * Reporters subscribe to signal patterns and react to signals
 * as they flow through the SignalBus.
 *
 * @example
 * ```ts
 * const myReporter: SignalReporter = {
 *   patterns: ["harness:*", "agent:activated"],
 *   onSignal: (signal) => {
 *     console.log(`[${signal.name}]`, signal.payload);
 *   },
 * };
 *
 * attachReporter(bus, myReporter);
 * ```
 */

import type { Signal } from "@internal/signals-core";
import type { ISignalBus, Unsubscribe } from "./bus.js";
import type { SignalPattern } from "./patterns.js";

/**
 * Context passed to reporters for accessing shared state
 */
export interface ReporterContext {
	/** Run ID for correlation */
	runId?: string;
	/** Additional metadata */
	meta?: Record<string, unknown>;
}

/**
 * Signal reporter interface.
 *
 * Reporters declare which signals they want to receive via `patterns`,
 * and handle them via `onSignal`.
 */
export interface SignalReporter {
	/** Human-readable name for the reporter */
	readonly name: string;

	/**
	 * Signal patterns this reporter subscribes to.
	 * Uses glob syntax: "harness:*", "agent:**", "state:analysis:changed"
	 */
	readonly patterns: SignalPattern[];

	/**
	 * Called for each signal matching the patterns.
	 *
	 * @param signal - The signal that was emitted
	 * @param ctx - Reporter context with run metadata
	 */
	onSignal(signal: Signal, ctx: ReporterContext): void;

	/**
	 * Optional: Called when reporter is attached to a bus.
	 * Use for initialization.
	 */
	onAttach?(): void;

	/**
	 * Optional: Called when reporter is detached from a bus.
	 * Use for cleanup and final reporting.
	 */
	onDetach?(): void;
}

/**
 * Attach a reporter to a SignalBus.
 *
 * @param bus - The SignalBus to attach to
 * @param reporter - The reporter to attach
 * @param ctx - Optional context to pass to the reporter
 * @returns Unsubscribe function to detach the reporter
 *
 * @example
 * ```ts
 * const unsubscribe = attachReporter(bus, consoleReporter, { runId: "abc123" });
 *
 * // Later, to detach:
 * unsubscribe();
 * ```
 */
export function attachReporter(bus: ISignalBus, reporter: SignalReporter, ctx: ReporterContext = {}): Unsubscribe {
	// Call onAttach if defined
	reporter.onAttach?.();

	// Subscribe to the reporter's patterns
	const unsubscribe = bus.subscribe(reporter.patterns, (signal) => {
		reporter.onSignal(signal, ctx);
	});

	// Return a wrapped unsubscribe that also calls onDetach
	return () => {
		unsubscribe();
		reporter.onDetach?.();
	};
}

/**
 * Attach multiple reporters to a SignalBus.
 *
 * @param bus - The SignalBus to attach to
 * @param reporters - Array of reporters to attach
 * @param ctx - Optional context to pass to all reporters
 * @returns Unsubscribe function that detaches all reporters
 */
export function attachReporters(bus: ISignalBus, reporters: SignalReporter[], ctx: ReporterContext = {}): Unsubscribe {
	const unsubscribes = reporters.map((reporter) => attachReporter(bus, reporter, ctx));

	return () => {
		for (const unsub of unsubscribes) {
			unsub();
		}
	};
}
