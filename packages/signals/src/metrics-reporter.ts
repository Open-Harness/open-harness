/**
 * MetricsSignalReporter - Collects metrics from signals
 *
 * Aggregates metrics like token usage, costs, latency, and activation counts
 * from provider and harness signals.
 *
 * @example
 * ```ts
 * import { SignalBus, attachReporter } from "@signals/bus";
 * import { createMetricsReporter } from "@signals/bus/metrics-reporter";
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

import type { Signal } from "@signals/core";
import type { ReporterContext, SignalReporter } from "./reporter.js";

/**
 * Aggregated metrics collected from signals
 */
export interface AggregatedMetrics {
	/** Total input tokens across all provider calls */
	totalInputTokens: number;
	/** Total output tokens across all provider calls */
	totalOutputTokens: number;
	/** Total cost in USD (if available in signals) */
	totalCost: number;
	/** Number of provider calls */
	providerCalls: number;
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
			providerCalls: 0,
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

		// Subscribe to provider and harness signals for metrics
		patterns: ["provider:end", "harness:start", "harness:end", "agent:activated"],

		onSignal(signal: Signal, _ctx: ReporterContext): void {
			switch (signal.name) {
				case "harness:start": {
					metrics.startedAt = signal.timestamp;
					notifyUpdate();
					break;
				}

				case "harness:end": {
					metrics.endedAt = signal.timestamp;
					const payload = signal.payload as { durationMs?: number } | undefined;
					if (payload?.durationMs) {
						metrics.durationMs = payload.durationMs;
					}
					notifyUpdate();
					break;
				}

				case "provider:end": {
					metrics.providerCalls++;

					const payload = signal.payload as
						| {
								usage?: { inputTokens?: number; outputTokens?: number };
								cost?: number;
						  }
						| undefined;

					if (payload?.usage) {
						metrics.totalInputTokens += payload.usage.inputTokens ?? 0;
						metrics.totalOutputTokens += payload.usage.outputTokens ?? 0;
					}

					if (payload?.cost) {
						metrics.totalCost += payload.cost;
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
