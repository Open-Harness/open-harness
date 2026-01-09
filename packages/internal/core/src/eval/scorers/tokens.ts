/**
 * Token usage scorer for the eval system.
 *
 * Scores based on total token usage from agent:complete events.
 */

import type { Scorer, Score, EvalArtifact } from "../types.js";
import { extractMetrics } from "../assertions.js";

/**
 * Configuration for the tokens scorer.
 */
export type TokensScorerConfig = {
	/**
	 * Maximum acceptable total tokens (input + output).
	 * Default: 100000
	 */
	maxTokens?: number;

	/**
	 * Ideal token count for a perfect score.
	 * Default: 0
	 */
	idealTokens?: number;

	/**
	 * Weight for input tokens vs output tokens.
	 * 1.0 = equal weight, > 1.0 = more weight on input, < 1.0 = more weight on output.
	 * Default: 1.0
	 */
	inputWeight?: number;
};

/**
 * Create a tokens scorer.
 *
 * The score is calculated based on weighted total tokens:
 * - 1.0 if tokens <= idealTokens
 * - 0.0 if tokens >= maxTokens
 * - Linear interpolation between
 *
 * @param config - Scorer configuration
 * @returns Tokens scorer
 */
export function createTokensScorer(config?: TokensScorerConfig): Scorer {
	const maxTokens = config?.maxTokens ?? 100000;
	const idealTokens = config?.idealTokens ?? 0;
	const inputWeight = config?.inputWeight ?? 1.0;

	return {
		name: "tokens",
		score(artifact: EvalArtifact): Score {
			const metrics = extractMetrics(artifact.events);

			// Calculate weighted total
			const weightedTotal =
				metrics.totalInputTokens * inputWeight + metrics.totalOutputTokens;
			const totalTokens = metrics.totalInputTokens + metrics.totalOutputTokens;

			// Calculate normalized score (0-1)
			let value: number;
			if (weightedTotal <= idealTokens) {
				value = 1.0;
			} else if (weightedTotal >= maxTokens) {
				value = 0.0;
			} else {
				// Linear interpolation
				value = 1.0 - (weightedTotal - idealTokens) / (maxTokens - idealTokens);
			}

			return {
				name: "tokens",
				value,
				rawValue: totalTokens,
				metadata: {
					maxTokens,
					idealTokens,
					inputWeight,
					inputTokens: metrics.totalInputTokens,
					outputTokens: metrics.totalOutputTokens,
					weightedTotal,
				},
			};
		},
	};
}

/**
 * Default tokens scorer with standard configuration.
 */
export const defaultTokensScorer = createTokensScorer();
