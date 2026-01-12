/**
 * MetricsSignalReporter - Collects metrics from signals
 *
 * Aggregates metrics like token usage, costs, latency, and activation counts
 * from harness and agent signals.
 *
 * @example
 * ```ts
 * import { SignalBus, attachReporter } from "@internal/signals";
 * import { createMetricsReporter } from "@internal/signals/metrics-reporter";
 *
 * const bus = new SignalBus();
 * const reporter = createMetricsReporter();
 *
 * const detach = attachReporter(bus, reporter);
 *
 * // Run your harness...
 *
 * // Get metrics
 * const metrics = reporter.getMetrics();
 * console.log(metrics.totalInputTokens);
 * console.log(metrics.totalCost);
 *
 * detach();
 * ```
 */

import type { Signal } from "@internal/signals-core";
import type { ReporterContext, SignalReporter } from "./reporter.js";

/**
 * Aggregated metrics collected from signals
 */
export interface AggregatedMetrics {
	/** Total input tokens across all harness calls */
	totalInputTokens: number;
	/** Total output tokens across all harness calls */
	totalOutputTokens: number;
	/** Total cost in USD (if available in signals) */
	totalCost: number;
	/** Number of harness calls */
	harnessCalls: number;
	/** Number of agent activations */
	agentActivations: number;
	/** Total duration in milliseconds (from harness:end if available) */
	durationMs: number;
	/** Start timestamp */
	startedAt?: string;
	/** End timestamp */
	endedAt?: string;
	/** Per-agent activation counts */
	agentCounts: Record<string, number>;
}

/**
 * Options for the metrics reporter
 */
export interface MetricsReporterOptions {
	/**
	 * Callback invoked when metrics are updated.
	 * Useful for real-time dashboards or monitoring.
	 */
	onUpdate?: (metrics: AggregatedMetrics) => void;
}

/**
 * Extended signal reporter with metrics access
 */
export interface MetricsSignalReporter extends SignalReporter {
	/** Get current aggregated metrics */
	getMetrics(): AggregatedMetrics;
	/** Reset all metrics to initial state */
	reset(): void;
}

/**
 * Create a metrics signal reporter.
 *
 * @param options - Configuration options
 * @returns A SignalReporter that collects metrics
 *
 * @example
 * ```ts
 * const reporter = createMetricsReporter({
 *   onUpdate: (metrics) => {
 *     console.log(`Tokens used: ${metrics.totalInputTokens + metrics.totalOutputTokens}`);
 *   },
 * });
 * ```
 */
export function createMetricsReporter(options: MetricsReporterOptions = {}): MetricsSignalReporter {
	const { onUpdate } = options;

	// Initialize metrics
	let metrics: AggregatedMetrics = createEmptyMetrics();

	function createEmptyMetrics(): AggregatedMetrics {
		return {
			totalInputTokens: 0,
			totalOutputTokens: 0,
			totalCost: 0,
			harnessCalls: 0,
			agentActivations: 0,
			durationMs: 0,
			agentCounts: {},
		};
	}

	function notifyUpdate(): void {
		onUpdate?.(metrics);
	}

	return {
		name: "metrics",

		// Subscribe to harness and agent signals for metrics
		patterns: ["harness:start", "harness:end", "agent:activated"],

		onSignal(signal: Signal, _ctx: ReporterContext): void {
			switch (signal.name) {
				case "harness:start": {
					metrics.startedAt = signal.timestamp;
					notifyUpdate();
					break;
				}

				case "harness:end": {
					metrics.endedAt = signal.timestamp;
					metrics.harnessCalls++;

					const payload = signal.payload as
						| {
								durationMs?: number;
								output?: {
									usage?: { inputTokens?: number; outputTokens?: number };
									cost?: number;
								};
						  }
						| undefined;

					if (payload?.durationMs) {
						metrics.durationMs = payload.durationMs;
					}

					// Usage is nested under output (harness emits { output: { usage: {...} } })
					if (payload?.output?.usage) {
						metrics.totalInputTokens += payload.output.usage.inputTokens ?? 0;
						metrics.totalOutputTokens += payload.output.usage.outputTokens ?? 0;
					}

					if (payload?.output?.cost) {
						metrics.totalCost += payload.output.cost;
					}

					notifyUpdate();
					break;
				}

				case "agent:activated": {
					metrics.agentActivations++;

					const payload = signal.payload as { agent?: string } | undefined;
					if (payload?.agent) {
						metrics.agentCounts[payload.agent] = (metrics.agentCounts[payload.agent] ?? 0) + 1;
					}

					notifyUpdate();
					break;
				}
			}
		},

		getMetrics(): AggregatedMetrics {
			return { ...metrics, agentCounts: { ...metrics.agentCounts } };
		},

		reset(): void {
			metrics = createEmptyMetrics();
		},
	};
}
