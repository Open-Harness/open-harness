/**
 * SignalBus - Central dispatcher for all signals
 *
 * Handles:
 * - Signal emission
 * - Subscriber notification
 * - Pattern matching for subscriptions
 * - History recording
 */

import type { Signal } from "@internal/signals-core";
import { type CompiledPattern, compilePattern, matchesPattern, type SignalPattern } from "./patterns.js";

/**
 * Handler function for signal subscriptions
 */
export type SignalHandler<T = unknown> = (signal: Signal<T>) => void;

/**
 * Function to unsubscribe from signals
 */
export type Unsubscribe = () => void;

/**
 * A subscription entry in the bus
 */
interface Subscription {
	readonly id: string;
	readonly patterns: CompiledPattern[];
	readonly handler: SignalHandler;
}

/**
 * Options for creating a SignalBus
 */
export interface SignalBusOptions {
	/** Maximum number of signals to keep in history (default: 1000) */
	maxHistory?: number;
}

/**
 * SignalBus interface
 */
export interface ISignalBus {
	/** Emit a signal to all matching subscribers */
	emit<T>(signal: Signal<T>): void;
	/** Subscribe to signals matching the given pattern(s) */
	subscribe<T = unknown>(patterns: SignalPattern | SignalPattern[], handler: SignalHandler<T>): Unsubscribe;
	/** Get the history of emitted signals */
	history(): readonly Signal[];
	/** Clear all history */
	clearHistory(): void;
	/** Get the number of active subscriptions */
	subscriptionCount(): number;
}

/**
 * SignalBus - central event dispatcher for the reactive architecture
 *
 * @example
 * ```ts
 * const bus = new SignalBus();
 *
 * // Subscribe to specific signal
 * bus.subscribe("analysis:complete", (signal) => {
 *   console.log("Analysis done:", signal.payload);
 * });
 *
 * // Subscribe to pattern
 * bus.subscribe("node:*:completed", (signal) => {
 *   console.log("Node completed:", signal.name);
 * });
 *
 * // Emit signal
 * bus.emit(createSignal("analysis:complete", { result: "bullish" }));
 * ```
 */
export class SignalBus implements ISignalBus {
	private subscriptions: Map<string, Subscription> = new Map();
	private signalHistory: Signal[] = [];
	private readonly maxHistory: number;
	private nextSubscriptionId = 0;

	constructor(options: SignalBusOptions = {}) {
		this.maxHistory = options.maxHistory ?? 1000;
	}

	/**
	 * Emit a signal to all matching subscribers
	 */
	emit<T>(signal: Signal<T>): void {
		// Add to history
		this.signalHistory.push(signal);

		// Trim history if needed
		if (this.signalHistory.length > this.maxHistory) {
			this.signalHistory = this.signalHistory.slice(-this.maxHistory);
		}

		// Notify matching subscribers
		for (const subscription of this.subscriptions.values()) {
			const matches = subscription.patterns.some((pattern) => matchesPattern(signal.name, pattern));

			if (matches) {
				try {
					subscription.handler(signal);
				} catch (error) {
					// Log but don't propagate handler errors
					console.error(`SignalBus: Error in handler for ${signal.name}:`, error);
				}
			}
		}
	}

	/**
	 * Subscribe to signals matching the given pattern(s)
	 *
	 * @param patterns - Single pattern or array of patterns to match
	 * @param handler - Function called when a matching signal is emitted
	 * @returns Unsubscribe function
	 */
	subscribe<T = unknown>(patterns: SignalPattern | SignalPattern[], handler: SignalHandler<T>): Unsubscribe {
		const patternArray = Array.isArray(patterns) ? patterns : [patterns];
		const compiledPatterns = patternArray.map(compilePattern);

		const id = `sub_${this.nextSubscriptionId++}`;
		const subscription: Subscription = {
			id,
			patterns: compiledPatterns,
			handler: handler as SignalHandler,
		};

		this.subscriptions.set(id, subscription);

		// Return unsubscribe function
		return () => {
			this.subscriptions.delete(id);
		};
	}

	/**
	 * Get the history of emitted signals (read-only)
	 */
	history(): readonly Signal[] {
		return this.signalHistory;
	}

	/**
	 * Clear all history
	 */
	clearHistory(): void {
		this.signalHistory = [];
	}

	/**
	 * Get the number of active subscriptions
	 */
	subscriptionCount(): number {
		return this.subscriptions.size;
	}
}
