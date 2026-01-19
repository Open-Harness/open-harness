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
 * Options for creating a signal
 */
export interface CreateSignalOptions {
	/** Source tracking for debugging and causality */
	source?: SignalSource;
}

/**
 * Helper to create a signal with auto-generated ID and timestamp
 *
 * @param name - Signal name using colon-separated namespacing
 * @param payload - Signal payload data
 * @param options - Optional source metadata for causality tracking
 *
 * @example
 * ```ts
 * // Simple signal
 * const sig = createSignal("task:complete", { taskId: "123" });
 *
 * // Signal with source for causality tracking
 * const sig = createSignal("plan:created", { taskCount: 5 }, {
 *   source: { agent: "planner", parent: "sig_abc123" }
 * });
 * ```
 */
export function createSignal<T>(name: string, payload: T, options?: SignalSource | CreateSignalOptions): Signal<T> {
	// Handle backward compatibility: if options is SignalSource (has agent/harness/parent), treat as source
	const isLegacySource =
		options && !("source" in options) && ("agent" in options || "harness" in options || "parent" in options);

	if (isLegacySource) {
		return {
			id: generateSignalId(),
			name,
			payload,
			timestamp: new Date().toISOString(),
			source: options as SignalSource,
		};
	}

	const opts = options as CreateSignalOptions | undefined;
	return {
		id: generateSignalId(),
		name,
		payload,
		timestamp: new Date().toISOString(),
		source: opts?.source,
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
