/**
 * Utility functions for assertion evaluation.
 */

import type { ValueMatcher } from "./types.js";

/**
 * Check if a value is a ValueMatcher object.
 */
export function isValueMatcher(value: unknown): value is ValueMatcher {
	if (typeof value !== "object" || value === null) return false;
	const keys = Object.keys(value);
	if (keys.length !== 1) return false;
	const key = keys[0];
	return ["gte", "lte", "gt", "lt", "between", "contains", "startsWith", "endsWith", "matches"].includes(key);
}

/**
 * Evaluate a ValueMatcher against a value.
 */
export function evaluateValueMatcher(actual: unknown, matcher: ValueMatcher): boolean {
	if ("gte" in matcher) {
		return typeof actual === "number" && actual >= matcher.gte;
	}
	if ("lte" in matcher) {
		return typeof actual === "number" && actual <= matcher.lte;
	}
	if ("gt" in matcher) {
		return typeof actual === "number" && actual > matcher.gt;
	}
	if ("lt" in matcher) {
		return typeof actual === "number" && actual < matcher.lt;
	}
	if ("between" in matcher) {
		return typeof actual === "number" && actual >= matcher.between[0] && actual <= matcher.between[1];
	}
	if ("contains" in matcher) {
		return typeof actual === "string" && actual.includes(matcher.contains);
	}
	if ("startsWith" in matcher) {
		return typeof actual === "string" && actual.startsWith(matcher.startsWith);
	}
	if ("endsWith" in matcher) {
		return typeof actual === "string" && actual.endsWith(matcher.endsWith);
	}
	if ("matches" in matcher) {
		if (typeof actual !== "string") return false;
		try {
			const regex = new RegExp(matcher.matches);
			return regex.test(actual);
		} catch {
			return false;
		}
	}
	return false;
}

/**
 * Check if actual payload matches expected payload (partial match).
 *
 * Expected payload can contain ValueMatchers for flexible matching.
 */
export function matchesPayload(actual: unknown, expected: Record<string, unknown>): boolean {
	if (typeof actual !== "object" || actual === null) return false;

	const actualObj = actual as Record<string, unknown>;

	for (const [key, expectedValue] of Object.entries(expected)) {
		const actualValue = actualObj[key];

		// Handle ValueMatcher
		if (isValueMatcher(expectedValue)) {
			if (!evaluateValueMatcher(actualValue, expectedValue)) {
				return false;
			}
			continue;
		}

		// Handle nested objects
		if (typeof expectedValue === "object" && expectedValue !== null && !Array.isArray(expectedValue)) {
			if (!matchesPayload(actualValue, expectedValue as Record<string, unknown>)) {
				return false;
			}
			continue;
		}

		// Direct equality check
		if (actualValue !== expectedValue) {
			return false;
		}
	}

	return true;
}

/**
 * Get a value at a dot-notation path.
 *
 * @example
 * getPath({ a: { b: [1, 2, 3] } }, "a.b[1]") // 2
 */
export function getPath(obj: unknown, path: string): unknown {
	if (obj === null || obj === undefined) return undefined;

	const parts = path.split(/\.|\[|\]/).filter(Boolean);
	let current: unknown = obj;

	for (const part of parts) {
		if (current === null || current === undefined) return undefined;
		if (typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}

	return current;
}

/**
 * Compare a value against an expected value, supporting ValueMatchers.
 */
export function valueMatches(actual: unknown, expected: unknown | ValueMatcher): boolean {
	if (isValueMatcher(expected)) {
		return evaluateValueMatcher(actual, expected);
	}

	// Handle nested objects
	if (typeof expected === "object" && expected !== null && typeof actual === "object" && actual !== null) {
		// Check if it's a ValueMatcher nested in an object
		if (isValueMatcher(expected)) {
			return evaluateValueMatcher(actual, expected);
		}

		// Recursive object comparison
		const expectedObj = expected as Record<string, unknown>;
		const actualObj = actual as Record<string, unknown>;

		for (const key of Object.keys(expectedObj)) {
			if (!valueMatches(actualObj[key], expectedObj[key])) {
				return false;
			}
		}
		return true;
	}

	// Direct comparison
	return actual === expected;
}

/**
 * Calculate percentile from an array of numbers.
 */
export function percentile(arr: number[], p: number): number {
	if (arr.length === 0) return 0;
	const sorted = [...arr].sort((a, b) => a - b);
	const index = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, index)];
}
