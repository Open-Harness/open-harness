/**
 * Telemetry - Wide Events derived from signals.
 *
 * Wide events aggregate signal streams into single, comprehensive events
 * that capture everything important about a workflow run. This pattern
 * reduces log volume while maximizing observability.
 *
 * @example
 * ```ts
 * import { createTelemetrySubscriber, type TelemetryConfig } from "@open-harness/core"
 *
 * const telemetry = createTelemetrySubscriber({
 *   emitter: (event) => logger.info(event),
 *   sampling: { rate: 0.1, alwaysOnError: true },
 * })
 *
 * // Subscribe to workflow signals
 * const result = await runReactive({
 *   agents: { ... },
 *   state: { ... },
 *   harness,
 * })
 *
 * // Emit wide event from result
 * telemetry.emit(result)
 * ```
 */

import type { Signal } from "@internal/signals-core";

// ============================================================================
// Types
// ============================================================================

/**
 * Token usage statistics.
 */
export type TokenUsage = {
	/** Input tokens consumed */
	inputTokens: number;
	/** Output tokens generated */
	outputTokens: number;
	/** Total tokens (input + output) */
	totalTokens: number;
};

/**
 * Cost breakdown for a workflow run.
 */
export type CostBreakdown = {
	/** Cost in USD */
	totalUsd: number;
	/** Cost per agent */
	perAgent?: Record<string, number>;
};

/**
 * Outcome of a workflow run.
 */
export type WorkflowOutcome = "success" | "error" | "timeout" | "terminated";

/**
 * Wide event emitted at workflow completion.
 *
 * Contains all relevant information about the run in a single event,
 * making it easy to query and analyze in log aggregation systems.
 */
export type WorkflowWideEvent = {
	/** Event type identifier */
	readonly event: "workflow.complete";

	/** Unique run identifier */
	readonly runId: string;

	/** Timestamp when the run started (ISO-8601) */
	readonly startedAt: string;

	/** Timestamp when the run completed (ISO-8601) */
	readonly completedAt: string;

	/** Total duration in milliseconds */
	readonly durationMs: number;

	/** Outcome of the run */
	readonly outcome: WorkflowOutcome;

	/** Error message if outcome is "error" */
	readonly error?: string;

	/** Number of agent activations */
	readonly activations: number;

	/** Names of agents that were activated */
	readonly agentsActivated: string[];

	/** Total signals emitted during run */
	readonly signalCount: number;

	/** Token usage (if available from harnesses) */
	readonly tokens?: TokenUsage;

	/** Cost breakdown (if available) */
	readonly cost?: CostBreakdown;

	/** Whether the workflow terminated early via endWhen */
	readonly terminatedEarly: boolean;

	/** Sampled signals (based on sampling config) */
	readonly sampledSignals?: readonly Signal[];

	/** Custom metadata attached to the run */
	readonly metadata?: Record<string, unknown>;
};

/**
 * Wide event emitted when workflow starts.
 */
export type WorkflowStartEvent = {
	readonly event: "workflow.start";
	readonly runId: string;
	readonly startedAt: string;
	readonly agents: string[];
	readonly metadata?: Record<string, unknown>;
};

/**
 * Wide event emitted on workflow error.
 */
export type WorkflowErrorEvent = {
	readonly event: "workflow.error";
	readonly runId: string;
	readonly timestamp: string;
	readonly error: string;
	readonly stack?: string;
	readonly phase: "startup" | "execution" | "shutdown";
	readonly metadata?: Record<string, unknown>;
};

/**
 * Union of all workflow wide events.
 */
export type WorkflowEvent = WorkflowStartEvent | WorkflowWideEvent | WorkflowErrorEvent;

/**
 * Sampling configuration for signal inclusion in wide events.
 */
export type SamplingConfig = {
	/**
	 * Sampling rate (0.0 to 1.0).
	 * 0.1 means 10% of signals are sampled.
	 * @default 0.1
	 */
	rate?: number;

	/**
	 * Always include all signals when outcome is error.
	 * @default true
	 */
	alwaysOnError?: boolean;

	/**
	 * Maximum number of signals to include.
	 * @default 100
	 */
	maxSignals?: number;

	/**
	 * Signal patterns to always include (glob syntax).
	 * @example ["error:*", "agent:activated"]
	 */
	alwaysInclude?: string[];

	/**
	 * Signal patterns to never include.
	 * @example ["text:delta", "harness:*"]
	 */
	neverInclude?: string[];
};

/**
 * Configuration for the telemetry subscriber.
 */
export type TelemetryConfig = {
	/**
	 * Function to emit wide events.
	 * Typically logs to Pino, sends to an APM, etc.
	 */
	emitter: (event: WorkflowEvent) => void;

	/**
	 * Sampling configuration for signal inclusion.
	 */
	sampling?: SamplingConfig;

	/**
	 * Custom metadata to attach to all events.
	 */
	metadata?: Record<string, unknown>;

	/**
	 * Whether to emit workflow.start events.
	 * @default true
	 */
	emitStart?: boolean;

	/**
	 * Whether to emit workflow.error events.
	 * @default true
	 */
	emitError?: boolean;
};

// ============================================================================
// Implementation
// ============================================================================

/**
 * Default sampling configuration.
 */
const DEFAULT_SAMPLING: Required<SamplingConfig> = {
	rate: 0.1,
	alwaysOnError: true,
	maxSignals: 100,
	alwaysInclude: ["error:*", "agent:activated", "workflow:*"],
	neverInclude: ["text:delta", "thinking:delta"],
};

/**
 * Check if a signal name matches a glob pattern.
 * Supports * for single segment and ** for multiple segments.
 */
function matchesPattern(signalName: string, pattern: string): boolean {
	// Convert glob to regex
	const regexPattern = pattern
		.replace(/\*\*/g, "<<<DOUBLE>>>")
		.replace(/\*/g, "[^:]*")
		.replace(/<<<DOUBLE>>>/g, ".*");

	const regex = new RegExp(`^${regexPattern}$`);
	return regex.test(signalName);
}

/**
 * Sample signals based on configuration.
 */
function sampleSignals(
	signals: readonly Signal[],
	config: SamplingConfig,
	isError: boolean,
): readonly Signal[] {
	const sampling = { ...DEFAULT_SAMPLING, ...config };

	// If error and alwaysOnError, include all (up to max)
	if (isError && sampling.alwaysOnError) {
		return signals.slice(0, sampling.maxSignals);
	}

	const sampled: Signal[] = [];

	for (const signal of signals) {
		// Check never include patterns
		if (sampling.neverInclude.some((p) => matchesPattern(signal.name, p))) {
			continue;
		}

		// Check always include patterns
		if (sampling.alwaysInclude.some((p) => matchesPattern(signal.name, p))) {
			sampled.push(signal);
			continue;
		}

		// Random sampling
		if (Math.random() < sampling.rate) {
			sampled.push(signal);
		}
	}

	return sampled.slice(0, sampling.maxSignals);
}

/**
 * Extract token usage from signals.
 */
function extractTokenUsage(signals: readonly Signal[]): TokenUsage | undefined {
	let inputTokens = 0;
	let outputTokens = 0;

	for (const signal of signals) {
		if (signal.name === "harness:end") {
			const payload = signal.payload as {
				usage?: { inputTokens?: number; outputTokens?: number };
			};
			if (payload.usage) {
				inputTokens += payload.usage.inputTokens ?? 0;
				outputTokens += payload.usage.outputTokens ?? 0;
			}
		}
	}

	if (inputTokens === 0 && outputTokens === 0) {
		return undefined;
	}

	return {
		inputTokens,
		outputTokens,
		totalTokens: inputTokens + outputTokens,
	};
}

/**
 * Extract activated agent names from signals.
 */
function extractAgentsActivated(signals: readonly Signal[]): string[] {
	const agents = new Set<string>();

	for (const signal of signals) {
		if (signal.name === "agent:activated") {
			const payload = signal.payload as { agent?: string };
			if (payload.agent) {
				agents.add(payload.agent);
			}
		}
	}

	return Array.from(agents);
}

/**
 * Result type expected by the telemetry subscriber.
 */
export type TelemetryInput = {
	signals: readonly Signal[];
	metrics: {
		durationMs: number;
		activations: number;
	};
	terminatedEarly: boolean;
	error?: Error;
};

/**
 * Telemetry subscriber that aggregates signals into wide events.
 */
export type TelemetrySubscriber = {
	/**
	 * Emit a workflow.start event.
	 */
	emitStart: (runId: string, agents: string[]) => void;

	/**
	 * Emit a workflow.complete wide event from run results.
	 */
	emitComplete: (runId: string, startedAt: string, result: TelemetryInput) => void;

	/**
	 * Emit a workflow.error event.
	 */
	emitError: (
		runId: string,
		error: Error,
		phase: "startup" | "execution" | "shutdown",
	) => void;
};

/**
 * Create a telemetry subscriber that aggregates signals into wide events.
 *
 * @param config - Telemetry configuration
 * @returns Telemetry subscriber with emit methods
 *
 * @example
 * ```ts
 * const telemetry = createTelemetrySubscriber({
 *   emitter: (event) => logger.info(event),
 *   sampling: { rate: 0.1, alwaysOnError: true },
 * })
 *
 * const runId = crypto.randomUUID()
 * const startedAt = new Date().toISOString()
 *
 * telemetry.emitStart(runId, ["analyst", "executor"])
 *
 * try {
 *   const result = await runReactive({ ... })
 *   telemetry.emitComplete(runId, startedAt, result)
 * } catch (error) {
 *   telemetry.emitError(runId, error, "execution")
 * }
 * ```
 */
export function createTelemetrySubscriber(
	config: TelemetryConfig,
): TelemetrySubscriber {
	const { emitter, sampling = {}, metadata = {} } = config;
	const emitStart = config.emitStart ?? true;
	const emitErrorEvents = config.emitError ?? true;

	return {
		emitStart(runId: string, agents: string[]): void {
			if (!emitStart) return;

			const event: WorkflowStartEvent = {
				event: "workflow.start",
				runId,
				startedAt: new Date().toISOString(),
				agents,
				metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
			};

			emitter(event);
		},

		emitComplete(
			runId: string,
			startedAt: string,
			result: TelemetryInput,
		): void {
			const completedAt = new Date().toISOString();
			const isError = result.error !== undefined;

			// Determine outcome
			let outcome: WorkflowOutcome = "success";
			if (result.error) {
				outcome = result.error.name === "TimeoutError" ? "timeout" : "error";
			} else if (result.terminatedEarly) {
				outcome = "terminated";
			}

			const event: WorkflowWideEvent = {
				event: "workflow.complete",
				runId,
				startedAt,
				completedAt,
				durationMs: result.metrics.durationMs,
				outcome,
				error: result.error?.message,
				activations: result.metrics.activations,
				agentsActivated: extractAgentsActivated(result.signals),
				signalCount: result.signals.length,
				tokens: extractTokenUsage(result.signals),
				terminatedEarly: result.terminatedEarly,
				sampledSignals: sampleSignals(result.signals, sampling, isError),
				metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
			};

			emitter(event);
		},

		emitError(
			runId: string,
			error: Error,
			phase: "startup" | "execution" | "shutdown",
		): void {
			if (!emitErrorEvents) return;

			const event: WorkflowErrorEvent = {
				event: "workflow.error",
				runId,
				timestamp: new Date().toISOString(),
				error: error.message,
				stack: error.stack,
				phase,
				metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
			};

			emitter(event);
		},
	};
}

/**
 * Helper to create a wide event from workflow result.
 * Useful when not using the full subscriber pattern.
 */
export function createWideEvent(
	runId: string,
	startedAt: string,
	result: TelemetryInput,
	sampling?: SamplingConfig,
): WorkflowWideEvent {
	const completedAt = new Date().toISOString();
	const isError = result.error !== undefined;

	let outcome: WorkflowOutcome = "success";
	if (result.error) {
		outcome = result.error.name === "TimeoutError" ? "timeout" : "error";
	} else if (result.terminatedEarly) {
		outcome = "terminated";
	}

	return {
		event: "workflow.complete",
		runId,
		startedAt,
		completedAt,
		durationMs: result.metrics.durationMs,
		outcome,
		error: result.error?.message,
		activations: result.metrics.activations,
		agentsActivated: extractAgentsActivated(result.signals),
		signalCount: result.signals.length,
		tokens: extractTokenUsage(result.signals),
		terminatedEarly: result.terminatedEarly,
		sampledSignals: sampleSignals(result.signals, sampling ?? {}, isError),
	};
}
