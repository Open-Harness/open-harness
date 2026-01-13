/**
 * Custom Vitest matchers for Open Harness run results.
 *
 * These matchers allow asserting on performance and cost metrics
 * of agent runs in a fluent, readable way.
 *
 * @example
 * ```ts
 * import { test, expect } from 'vitest'
 * import { run, agent, setupMatchers } from '@open-harness/vitest'
 *
 * setupMatchers()
 *
 * test('agent responds quickly and cheaply', async () => {
 *   const result = await run(myAgent, { prompt: 'Hello' })
 *
 *   expect(result).toHaveLatencyUnder(5000)  // < 5 seconds
 *   expect(result).toCostUnder(0.01)         // < $0.01
 *   expect(result).toHaveTokensUnder(1000)   // < 1000 total tokens
 * })
 * ```
 *
 * @example Signal assertions
 * ```ts
 * import { runReactive } from '@open-harness/vitest'
 *
 * test('harness emits expected signals', async () => {
 *   const result = await runReactive({ agents: {...}, state: {...} })
 *
 *   expect(result.signals).toContainSignal('agent:activated')
 *   expect(result.signals).toContainSignal({ name: 'analysis:complete', payload: { confidence: 0.9 } })
 *   expect(result.signals).toHaveSignalCount('harness:end', 2)
 * })
 * ```
 */

import { compilePattern, matchesPattern, type RunResult, type Signal, type SignalPattern } from "@open-harness/core";

// ============================================================================
// Signal Matcher Types
// ============================================================================

/**
 * Matcher for signal assertions.
 * Can be a string pattern (glob supported) or an object with name and optional payload.
 */
export type SignalMatcher =
	| SignalPattern
	| {
			/** Signal name pattern (glob supported) */
			name: SignalPattern;
			/** Partial payload to match (deep partial equality) */
			payload?: Record<string, unknown>;
	  };

/**
 * Deep partial match - check if actual contains all properties from expected
 */
function deepPartialMatch(actual: unknown, expected: unknown): boolean {
	if (expected === undefined) return true;

	// Handle primitives
	if (typeof expected !== "object" || expected === null) {
		return actual === expected;
	}

	// Handle arrays
	if (Array.isArray(expected)) {
		if (!Array.isArray(actual)) return false;
		return expected.every((expectedItem, i) => deepPartialMatch(actual[i], expectedItem));
	}

	// Handle objects
	if (typeof actual !== "object" || actual === null) {
		return false;
	}

	const actualObj = actual as Record<string, unknown>;
	const expectedObj = expected as Record<string, unknown>;

	return Object.keys(expectedObj).every((key) => deepPartialMatch(actualObj[key], expectedObj[key]));
}

/**
 * Check if a signal matches the given matcher
 */
function signalMatches(signal: Signal, matcher: SignalMatcher): boolean {
	// Handle string/RegExp pattern
	if (typeof matcher === "string" || matcher instanceof RegExp) {
		const compiled = compilePattern(matcher);
		return matchesPattern(signal.name, compiled);
	}

	// Handle object matcher with name and optional payload
	const compiled = compilePattern(matcher.name);
	if (!matchesPattern(signal.name, compiled)) {
		return false;
	}

	// Check payload if specified
	if (matcher.payload !== undefined) {
		return deepPartialMatch(signal.payload, matcher.payload);
	}

	return true;
}

/**
 * Custom matchers for RunResult assertions.
 */
export const matchers = {
	/**
	 * Assert that the run completed within the given latency threshold.
	 *
	 * @param received - The RunResult from running an agent/harness
	 * @param threshold - Maximum allowed latency in milliseconds
	 *
	 * @example
	 * ```ts
	 * expect(result).toHaveLatencyUnder(5000)  // < 5 seconds
	 * ```
	 */
	toHaveLatencyUnder(received: RunResult, threshold: number) {
		const latencyMs = received.metrics.latencyMs;
		const pass = latencyMs < threshold;
		return {
			pass,
			message: () =>
				pass
					? `Expected latency >= ${threshold}ms, got ${latencyMs}ms`
					: `Expected latency < ${threshold}ms, got ${latencyMs}ms`,
		};
	},

	/**
	 * Assert that the run cost less than the given USD amount.
	 *
	 * @param received - The RunResult from running an agent/harness
	 * @param maxUsd - Maximum allowed cost in USD
	 *
	 * @example
	 * ```ts
	 * expect(result).toCostUnder(0.01)  // < $0.01
	 * ```
	 */
	toCostUnder(received: RunResult, maxUsd: number) {
		const cost = received.metrics.cost;
		const pass = cost < maxUsd;
		return {
			pass,
			message: () => (pass ? `Expected cost >= $${maxUsd}, got $${cost}` : `Expected cost < $${maxUsd}, got $${cost}`),
		};
	},

	/**
	 * Assert that the run used fewer than the given total tokens.
	 *
	 * @param received - The RunResult from running an agent/harness
	 * @param maxTokens - Maximum allowed total tokens (input + output)
	 *
	 * @example
	 * ```ts
	 * expect(result).toHaveTokensUnder(1000)  // < 1000 total tokens
	 * ```
	 */
	toHaveTokensUnder(received: RunResult, maxTokens: number) {
		const total = received.metrics.tokens.input + received.metrics.tokens.output;
		const pass = total < maxTokens;
		return {
			pass,
			message: () =>
				pass ? `Expected tokens >= ${maxTokens}, got ${total}` : `Expected tokens < ${maxTokens}, got ${total}`,
		};
	},
};

// ============================================================================
// Signal Matchers
// ============================================================================

/**
 * Format a SignalMatcher for error messages
 */
function formatMatcher(matcher: SignalMatcher): string {
	if (typeof matcher === "string") {
		return `"${matcher}"`;
	}
	if (matcher instanceof RegExp) {
		return matcher.toString();
	}
	if (matcher.payload !== undefined) {
		return `{ name: "${matcher.name}", payload: ${JSON.stringify(matcher.payload)} }`;
	}
	return `{ name: "${matcher.name}" }`;
}

/**
 * Custom matchers for Signal array assertions.
 */
export const signalMatchers = {
	/**
	 * Assert that the signal array contains a signal matching the pattern.
	 *
	 * @param received - Array of Signal objects
	 * @param matcher - Signal name pattern (glob supported) or object with name and payload
	 *
	 * @example
	 * ```ts
	 * // Match by name pattern
	 * expect(result.signals).toContainSignal('agent:activated')
	 * expect(result.signals).toContainSignal('provider:*')
	 *
	 * // Match by name and payload
	 * expect(result.signals).toContainSignal({
	 *   name: 'analysis:complete',
	 *   payload: { agent: 'analyst', confidence: 0.9 }
	 * })
	 * ```
	 */
	toContainSignal(received: readonly Signal[], matcher: SignalMatcher) {
		const found = received.some((signal) => signalMatches(signal, matcher));
		return {
			pass: found,
			message: () =>
				found
					? `Expected signals NOT to contain ${formatMatcher(matcher)}, but found matching signal`
					: `Expected signals to contain ${formatMatcher(matcher)}, but no match found.\nReceived signals: ${received.map((s) => s.name).join(", ")}`,
		};
	},

	/**
	 * Assert the exact count of signals matching a pattern.
	 *
	 * @param received - Array of Signal objects
	 * @param matcher - Signal name pattern (glob supported) or object with name and payload
	 * @param expectedCount - Expected number of matching signals
	 *
	 * @example
	 * ```ts
	 * // Expect exactly 2 harness:end signals
	 * expect(result.signals).toHaveSignalCount('harness:end', 2)
	 *
	 * // Expect exactly 3 agent activations
	 * expect(result.signals).toHaveSignalCount('agent:activated', 3)
	 * ```
	 */
	toHaveSignalCount(received: readonly Signal[], matcher: SignalMatcher, expectedCount: number) {
		const actualCount = received.filter((signal) => signalMatches(signal, matcher)).length;
		const pass = actualCount === expectedCount;
		return {
			pass,
			message: () =>
				pass
					? `Expected NOT to have ${expectedCount} signals matching ${formatMatcher(matcher)}`
					: `Expected ${expectedCount} signals matching ${formatMatcher(matcher)}, but found ${actualCount}`,
		};
	},

	/**
	 * Assert that signals appear in a specific order.
	 *
	 * @param received - Array of Signal objects
	 * @param orderedMatchers - Array of matchers that should appear in order
	 *
	 * @example
	 * ```ts
	 * expect(result.signals).toHaveSignalsInOrder([
	 *   'harness:start',
	 *   'agent:activated',
	 *   'harness:start',
	 *   'harness:end',
	 *   'harness:end'
	 * ])
	 * ```
	 */
	toHaveSignalsInOrder(received: readonly Signal[], orderedMatchers: SignalMatcher[]) {
		let lastIndex = -1;
		const missing: SignalMatcher[] = [];
		const outOfOrder: Array<{ matcher: SignalMatcher; foundAt: number; expectedAfter: number }> = [];

		for (const matcher of orderedMatchers) {
			const foundIndex = received.findIndex((signal, idx) => idx > lastIndex && signalMatches(signal, matcher));

			if (foundIndex === -1) {
				missing.push(matcher);
			} else if (foundIndex <= lastIndex) {
				outOfOrder.push({ matcher, foundAt: foundIndex, expectedAfter: lastIndex });
			} else {
				lastIndex = foundIndex;
			}
		}

		const pass = missing.length === 0 && outOfOrder.length === 0;

		return {
			pass,
			message: () => {
				if (missing.length > 0) {
					return `Expected signals in order, but missing: ${missing.map(formatMatcher).join(", ")}`;
				}
				if (outOfOrder.length > 0) {
					return `Signals out of order: ${outOfOrder.map((o) => formatMatcher(o.matcher)).join(", ")}`;
				}
				return "Signals are in expected order";
			},
		};
	},
};

/**
 * Register Open Harness matchers with Vitest's expect.
 *
 * Call this in your setupFiles or at the start of tests:
 *
 * @example Auto-setup via vitest.config.ts:
 * ```ts
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['@open-harness/vitest/setup'],
 *   }
 * })
 * ```
 *
 * @example Manual setup:
 * ```ts
 * import { expect } from 'vitest'
 * import { matchers, signalMatchers } from '@open-harness/vitest'
 * expect.extend(matchers)
 * expect.extend(signalMatchers)
 * ```
 */
export function setupMatchers(): void {
	// Try vitest's expect first (test environment)
	// Then fall back to global expect (production environment)
	const expectGlobal = (
		globalThis as unknown as {
			expect?: { extend?: (matchers: Record<string, unknown>) => void };
		}
	).expect;

	if (expectGlobal?.extend) {
		expectGlobal.extend(matchers);
		expectGlobal.extend(signalMatchers);
	}
}
