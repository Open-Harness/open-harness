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
 * Display types for rendering signals in different contexts
 *
 * - status: Persistent state indicator (e.g., "Planning...", "Running task 3/5")
 * - progress: Shows completion percentage or step counts
 * - notification: One-time event notification (e.g., "Plan created", "Task complete")
 * - stream: Streaming text content with append support
 * - log: Structured log output for debugging/observability
 */
export type SignalDisplayType = "status" | "progress" | "notification" | "stream" | "log";

/**
 * Display status for visual styling
 *
 * - pending: Not yet started (blue/gray)
 * - active: Currently in progress (yellow/animated)
 * - success: Completed successfully (green)
 * - error: Failed with error (red)
 * - warning: Completed with warnings (orange)
 */
export type SignalDisplayStatus = "pending" | "active" | "success" | "error" | "warning";

/**
 * SignalDisplay - metadata for rendering signals in adapters
 *
 * Provides hints to adapters (terminal, web, logs) for how to display signals.
 * All fields are optional - adapters use sensible defaults when metadata is absent.
 *
 * Note: title/subtitle functions accept `unknown` for type safety with Signal variance.
 * Use type assertions in adapters when you need typed access to payload.
 *
 * @example
 * ```ts
 * const display: SignalDisplay = {
 *   type: "notification",
 *   title: (payload) => {
 *     const p = payload as { taskCount: number };
 *     return `Plan created with ${p.taskCount} tasks`;
 *   },
 *   status: "success",
 *   icon: "✓"
 * };
 * ```
 */
export interface SignalDisplay {
	/** Display type determines rendering strategy */
	readonly type?: SignalDisplayType;

	/**
	 * Primary display text - can be static string or function of payload
	 * Functions receive the payload as unknown (use type assertion if needed)
	 */
	readonly title?: string | ((payload: unknown) => string);

	/**
	 * Secondary display text - additional context below title
	 * Functions receive the payload as unknown (use type assertion if needed)
	 */
	readonly subtitle?: string | ((payload: unknown) => string);

	/** Icon or emoji for visual identification */
	readonly icon?: string;

	/** Current status for visual styling (colors, animations) */
	readonly status?: SignalDisplayStatus;

	/**
	 * Progress information for progress-type displays
	 * Can be 0-100 percentage or { current, total } for step-based progress
	 */
	readonly progress?: number | { current: number; total: number };

	/**
	 * Whether to append content for stream-type displays
	 * When true, new content is appended rather than replacing
	 */
	readonly append?: boolean;
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
	/** Optional display metadata for adapter rendering */
	readonly display?: SignalDisplay;
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
	/** Display metadata for adapter rendering */
	display?: SignalDisplay;
}

/**
 * Helper to create a signal with auto-generated ID and timestamp
 *
 * @param name - Signal name using colon-separated namespacing
 * @param payload - Signal payload data
 * @param options - Optional source and display metadata
 *
 * @example
 * ```ts
 * // Simple signal
 * const sig = createSignal("task:complete", { taskId: "123" });
 *
 * // Signal with display metadata
 * const sig = createSignal("plan:created", { taskCount: 5 }, {
 *   display: {
 *     type: "notification",
 *     title: (p) => `Plan created with ${p.taskCount} tasks`,
 *     status: "success"
 *   }
 * });
 * ```
 */
export function createSignal<T>(name: string, payload: T, options?: SignalSource | CreateSignalOptions): Signal<T> {
	// Handle backward compatibility: if options is SignalSource (has agent/harness/parent), treat as source
	const isLegacySource =
		options &&
		!("source" in options) &&
		!("display" in options) &&
		("agent" in options || "harness" in options || "parent" in options);

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
		display: opts?.display,
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
