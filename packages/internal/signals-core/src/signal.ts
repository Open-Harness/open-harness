/**
 * Signal Source - tracks origin of a signal for causality/debugging
 */
export interface SignalSource {
	/** Agent that emitted this signal */
	readonly agent?: string;
	/** Harness that emitted this signal (for harness events) */
	readonly harness?: string;
	/** Parent signal ID that caused this signal (for causality chains) */
	readonly parent?: string;
}

/**
 * Signal - the fundamental primitive in the reactive architecture
 *
 * Signals are immutable events that flow through the system.
 * All state changes, agent activations, and harness responses are signals.
 *
 * @example
 * ```ts
 * const analysisComplete: Signal<AnalysisResult> = {
 *   id: "sig_abc123",
 *   name: "analysis:complete",
 *   payload: { sentiment: "bullish", confidence: 0.85 },
 *   timestamp: new Date().toISOString(),
 *   source: { agent: "analyst", parent: "sig_xyz789" }
 * };
 * ```
 */
export interface Signal<T = unknown> {
	/** Unique signal ID for causality tracking */
	readonly id: string;
	/** Signal name - uses colon-separated namespacing (e.g., "state:analysis:changed") */
	readonly name: string;
	/** Signal payload - the data carried by this signal */
	readonly payload: T;
	/** ISO timestamp when signal was emitted */
	readonly timestamp: string;
	/** Optional source tracking for debugging and causality */
	readonly source?: SignalSource;
}

/**
 * Generate a unique signal ID
 */
function generateSignalId(): string {
	return `sig_${crypto.randomUUID().slice(0, 12)}`;
}

/**
 * Helper to create a signal with auto-generated ID and timestamp
 */
export function createSignal<T>(name: string, payload: T, source?: SignalSource): Signal<T> {
	return {
		id: generateSignalId(),
		name,
		payload,
		timestamp: new Date().toISOString(),
		source,
	};
}

/**
 * Type guard to check if a value is a Signal
 */
export function isSignal(value: unknown): value is Signal {
	return (
		typeof value === "object" &&
		value !== null &&
		"id" in value &&
		"name" in value &&
		"payload" in value &&
		"timestamp" in value &&
		typeof (value as Signal).id === "string" &&
		typeof (value as Signal).name === "string" &&
		typeof (value as Signal).timestamp === "string"
	);
}
