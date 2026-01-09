/**
 * Judge cache for the eval system.
 *
 * Caches expensive LLM-as-judge results to avoid re-running judgments.
 */

import type { Score } from "./types.js";

/**
 * Interface for caching judge scores.
 *
 * The cache key should be derived from:
 * - Output path
 * - Evaluation criteria
 * - Actual output value (or its hash)
 *
 * This allows caching judgment results across runs when the
 * same output is evaluated with the same criteria.
 */
export interface EvalJudgeCache {
	/**
	 * Get a cached score.
	 *
	 * @param key - Cache key
	 * @returns Cached score if found, undefined otherwise
	 */
	get(key: string): Promise<Score | undefined>;

	/**
	 * Set a score in the cache.
	 *
	 * @param key - Cache key
	 * @param score - Score to cache
	 */
	set(key: string, score: Score): Promise<void>;

	/**
	 * Check if a key exists in the cache.
	 *
	 * @param key - Cache key
	 * @returns True if key exists
	 */
	has(key: string): Promise<boolean>;

	/**
	 * Clear all cached scores.
	 */
	clear(): Promise<void>;
}

/**
 * Create an in-memory judge cache.
 *
 * This cache is ephemeral and will be cleared when the process exits.
 * For persistent caching, use a file-backed implementation.
 *
 * @returns In-memory cache implementation
 */
export function createInMemoryCache(): EvalJudgeCache {
	const cache = new Map<string, Score>();

	return {
		async get(key: string): Promise<Score | undefined> {
			return cache.get(key);
		},

		async set(key: string, score: Score): Promise<void> {
			cache.set(key, score);
		},

		async has(key: string): Promise<boolean> {
			return cache.has(key);
		},

		async clear(): Promise<void> {
			cache.clear();
		},
	};
}

/**
 * Generate a cache key for a judge evaluation.
 *
 * The key is deterministic based on:
 * - Output path
 * - Evaluation criteria
 * - Actual output value
 *
 * @param outputPath - Path to the output being evaluated
 * @param criteria - Evaluation criteria/prompt
 * @param actualValue - The actual output value
 * @returns Cache key string
 */
export function generateJudgeCacheKey(
	outputPath: string,
	criteria: string,
	actualValue: unknown,
): string {
	const valueStr =
		typeof actualValue === "string"
			? actualValue
			: JSON.stringify(actualValue);

	// Simple hash-like key (not cryptographic, just for caching)
	const combined = `${outputPath}|${criteria}|${valueStr}`;

	// Use a simple string representation
	// For production, consider using a proper hash function
	return `judge:${simpleHash(combined)}`;
}

/**
 * Simple non-cryptographic hash for cache keys.
 */
function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(36);
}
