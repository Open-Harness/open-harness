/**
 * LLM-as-judge scorer for the eval system.
 *
 * Uses an LLM to evaluate outputs subjectively.
 * This is a stub implementation for v0.2.0 - disabled by default.
 *
 * NOTE: LLM judge is expensive and should be used sparingly.
 * Always use a cache to avoid re-running judgments.
 */

import type { EvalJudgeCache } from "../cache.js";
import type { EvalArtifact, Score, Scorer } from "../types.js";

/**
 * Configuration for the LLM judge scorer.
 */
export type LLMJudgeScorerConfig = {
	/**
	 * Path to the output to evaluate.
	 */
	outputPath: string;

	/**
	 * Evaluation criteria/prompt for the judge.
	 */
	criteria: string;

	/**
	 * Optional cache to avoid re-running expensive judgments.
	 */
	cache?: EvalJudgeCache;

	/**
	 * Whether the judge is enabled.
	 * Default: false (disabled for v0.2.0)
	 */
	enabled?: boolean;

	/**
	 * Model to use for judging.
	 * Default: "claude-4-5-haiku" (cheapest option)
	 */
	model?: string;
};

/**
 * Create an LLM judge scorer.
 *
 * NOTE: For v0.2.0, this is a stub that returns a fixed score of 0.5
 * when enabled, and 0 when disabled. Full implementation is planned
 * for future versions.
 *
 * When fully implemented, this scorer will:
 * 1. Extract the output at the specified path
 * 2. Send it to an LLM with the evaluation criteria
 * 3. Parse the LLM's response to get a score
 * 4. Cache the result to avoid re-running expensive judgments
 *
 * @param config - Scorer configuration
 * @returns LLM judge scorer
 */
export function createLLMJudgeScorer(config: LLMJudgeScorerConfig): Scorer {
	const enabled = config.enabled ?? false;

	return {
		name: "llm-judge",
		score(artifact: EvalArtifact): Score {
			if (!enabled) {
				return {
					name: "llm-judge",
					value: 0,
					rawValue: undefined,
					metadata: {
						enabled: false,
						reason: "LLM judge is disabled by default in v0.2.0",
					},
				};
			}

			const actual = resolvePath(artifact.snapshot.outputs, config.outputPath);

			if (actual === undefined) {
				return {
					name: "llm-judge",
					value: 0,
					rawValue: undefined,
					metadata: {
						outputPath: config.outputPath,
						error: "Output path not found",
					},
				};
			}

			// NOTE: Full LLM judgment is out-of-scope for v0.2.0
			// Current behavior returns stub value 0.5
			//
			// Future implementation would:
			// 1. Generate a cache key from (outputPath, criteria, actual)
			// 2. Check cache for existing judgment
			// 3. If not cached, call LLM with criteria + actual output
			// 4. Parse response for score (0-1)
			// 5. Cache and return

			return {
				name: "llm-judge",
				value: 0.5,
				rawValue: typeof actual === "string" ? actual : JSON.stringify(actual),
				metadata: {
					enabled: true,
					stub: true,
					reason: "LLM judge not fully implemented in v0.2.0",
					outputPath: config.outputPath,
					criteria: config.criteria,
					model: config.model ?? "claude-3-haiku",
				},
			};
		},
	};
}

/**
 * Helper to resolve a dot-notation path against an object.
 */
function resolvePath(obj: unknown, path: string): unknown {
	const parts = path.split(".");
	let current: unknown = obj;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}
		if (typeof current !== "object") {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}

	return current;
}
