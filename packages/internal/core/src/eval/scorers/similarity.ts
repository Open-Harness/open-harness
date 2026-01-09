/**
 * Similarity scorer for the eval system.
 *
 * Scores based on output similarity to expected values.
 * This is a stub implementation for v0.2.0 - full implementation planned for future versions.
 */

import type { Scorer, Score, EvalArtifact } from "../types.js";

/**
 * Configuration for the similarity scorer.
 */
export type SimilarityScorerConfig = {
	/**
	 * Path to the output to compare.
	 */
	outputPath: string;

	/**
	 * Expected value to compare against.
	 */
	expectedValue: string;

	/**
	 * Similarity algorithm to use.
	 * Default: "exact" (only exact match for v0.2.0)
	 */
	algorithm?: "exact" | "contains" | "levenshtein" | "semantic";
};

/**
 * Create a similarity scorer.
 *
 * NOTE: For v0.2.0, only "exact" and "contains" algorithms are implemented.
 * "levenshtein" and "semantic" are stubs that return 0.5.
 *
 * @param config - Scorer configuration
 * @returns Similarity scorer
 */
export function createSimilarityScorer(config: SimilarityScorerConfig): Scorer {
	const algorithm = config.algorithm ?? "exact";

	return {
		name: "similarity",
		score(artifact: EvalArtifact): Score {
			const actual = resolvePath(artifact.snapshot.outputs, config.outputPath);

			if (actual === undefined) {
				return {
					name: "similarity",
					value: 0,
					rawValue: undefined,
					metadata: {
						algorithm,
						outputPath: config.outputPath,
						error: "Output path not found",
					},
				};
			}

			const actualStr = typeof actual === "string" ? actual : JSON.stringify(actual);
			let value: number;
			let details: Record<string, unknown> = {};

			switch (algorithm) {
				case "exact":
					value = actualStr === config.expectedValue ? 1.0 : 0.0;
					details = { matched: value === 1.0 };
					break;

				case "contains":
					value = actualStr.includes(config.expectedValue) ? 1.0 : 0.0;
					details = { contained: value === 1.0 };
					break;

				case "levenshtein":
					// NOTE: Levenshtein distance scoring is out-of-scope for v0.2.0
					value = 0.5;
					details = { stub: true, reason: "Levenshtein not implemented in v0.2.0" };
					break;

				case "semantic":
					// NOTE: Semantic similarity (requires embeddings) is out-of-scope for v0.2.0
					value = 0.5;
					details = { stub: true, reason: "Semantic similarity not implemented in v0.2.0" };
					break;
			}

			return {
				name: "similarity",
				value,
				rawValue: actualStr,
				metadata: {
					algorithm,
					outputPath: config.outputPath,
					expectedValue: config.expectedValue,
					...details,
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
