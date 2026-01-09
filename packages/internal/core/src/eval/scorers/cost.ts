/**
 * Cost scorer for the eval system.
 *
 * Scores based on total cost (totalCostUsd from agent:complete events).
 */

import { extractMetrics } from "../assertions.js";
import type { EvalArtifact, Score, Scorer } from "../types.js";

/**
 * Configuration for the cost scorer.
 */
export type CostScorerConfig = {
	/**
	 * Maximum acceptable cost in USD.
	 * Scores below this are normalized to 1.0, above to 0.0.
	 * Default: 1.0 ($1.00)
	 */
	maxUsd?: number;

	/**
	 * Ideal cost in USD for a perfect score.
	 * Default: 0
	 */
	idealUsd?: number;
};

/**
 * Create a cost scorer.
 *
 * The score is calculated as:
 * - 1.0 if cost <= idealUsd
 * - 0.0 if cost >= maxUsd
 * - Linear interpolation between idealUsd and maxUsd
 *
 * @param config - Scorer configuration
 * @returns Cost scorer
 */
export function createCostScorer(config?: CostScorerConfig): Scorer {
	const maxUsd = config?.maxUsd ?? 1.0;
	const idealUsd = config?.idealUsd ?? 0;

	return {
		name: "cost",
		score(artifact: EvalArtifact): Score {
			const metrics = extractMetrics(artifact.events);
			const cost = metrics.totalCostUsd;

			// Calculate normalized score (0-1)
			let value: number;
			if (cost <= idealUsd) {
				value = 1.0;
			} else if (cost >= maxUsd) {
				value = 0.0;
			} else {
				// Linear interpolation
				value = 1.0 - (cost - idealUsd) / (maxUsd - idealUsd);
			}

			return {
				name: "cost",
				value,
				rawValue: cost,
				metadata: {
					maxUsd,
					idealUsd,
					unit: "USD",
				},
			};
		},
	};
}

/**
 * Default cost scorer with standard configuration.
 */
export const defaultCostScorer = createCostScorer();
