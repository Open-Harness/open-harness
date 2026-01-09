/**
 * Latency scorer for the eval system.
 *
 * Scores based on total workflow latency (durationMs from agent:complete events).
 */

import { extractMetrics } from "../assertions.js";
import type { EvalArtifact, Score, Scorer } from "../types.js";

/**
 * Configuration for the latency scorer.
 */
export type LatencyScorerConfig = {
	/**
	 * Maximum acceptable latency in milliseconds.
	 * Scores below this are normalized to 1.0, above to 0.0.
	 * Default: 30000 (30 seconds)
	 */
	maxMs?: number;

	/**
	 * Ideal latency in milliseconds for a perfect score.
	 * Default: 0
	 */
	idealMs?: number;
};

/**
 * Create a latency scorer.
 *
 * The score is calculated as:
 * - 1.0 if latency <= idealMs
 * - 0.0 if latency >= maxMs
 * - Linear interpolation between idealMs and maxMs
 *
 * @param config - Scorer configuration
 * @returns Latency scorer
 */
export function createLatencyScorer(config?: LatencyScorerConfig): Scorer {
	const maxMs = config?.maxMs ?? 30000;
	const idealMs = config?.idealMs ?? 0;

	return {
		name: "latency",
		score(artifact: EvalArtifact): Score {
			const metrics = extractMetrics(artifact.events);
			const latency = metrics.totalDurationMs;

			// Calculate normalized score (0-1)
			let value: number;
			if (latency <= idealMs) {
				value = 1.0;
			} else if (latency >= maxMs) {
				value = 0.0;
			} else {
				// Linear interpolation
				value = 1.0 - (latency - idealMs) / (maxMs - idealMs);
			}

			return {
				name: "latency",
				value,
				rawValue: latency,
				metadata: {
					maxMs,
					idealMs,
					unit: "ms",
				},
			};
		},
	};
}

/**
 * Default latency scorer with standard configuration.
 */
export const defaultLatencyScorer = createLatencyScorer();
