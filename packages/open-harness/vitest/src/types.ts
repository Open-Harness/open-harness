/**
 * TypeScript declarations for Open Harness Vitest matchers.
 *
 * These declarations augment Vitest's Assertion interface to provide
 * type-safe autocomplete for custom matchers.
 */

import type { SignalMatcher } from "./matchers.js";

/**
 * Custom Open Harness matchers for RunResult assertions.
 */
interface OpenHarnessMatchers<R = unknown> {
	/**
	 * Assert that the run completed within the given latency threshold.
	 *
	 * @param threshold - Maximum allowed latency in milliseconds
	 *
	 * @example
	 * ```ts
	 * expect(result).toHaveLatencyUnder(5000)  // < 5 seconds
	 * ```
	 */
	toHaveLatencyUnder(threshold: number): R;

	/**
	 * Assert that the run cost less than the given USD amount.
	 *
	 * @param maxUsd - Maximum allowed cost in USD
	 *
	 * @example
	 * ```ts
	 * expect(result).toCostUnder(0.01)  // < $0.01
	 * ```
	 */
	toCostUnder(maxUsd: number): R;

	/**
	 * Assert that the run used fewer than the given total tokens.
	 *
	 * @param maxTokens - Maximum allowed total tokens (input + output)
	 *
	 * @example
	 * ```ts
	 * expect(result).toHaveTokensUnder(1000)  // < 1000 total tokens
	 * ```
	 */
	toHaveTokensUnder(maxTokens: number): R;
}

/**
 * Signal-based matchers for reactive harness results.
 */
interface SignalMatchers<R = unknown> {
	/**
	 * Assert that the signal array contains a signal matching the pattern.
	 *
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
	toContainSignal(matcher: SignalMatcher): R;

	/**
	 * Assert the exact count of signals matching a pattern.
	 *
	 * @param matcher - Signal name pattern (glob supported) or object with name and payload
	 * @param expectedCount - Expected number of matching signals
	 *
	 * @example
	 * ```ts
	 * // Expect exactly 2 provider:end signals
	 * expect(result.signals).toHaveSignalCount('harness:end', 2)
	 *
	 * // Expect exactly 3 agent activations
	 * expect(result.signals).toHaveSignalCount('agent:activated', 3)
	 * ```
	 */
	toHaveSignalCount(matcher: SignalMatcher, expectedCount: number): R;

	/**
	 * Assert that signals appear in a specific order.
	 *
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
	toHaveSignalsInOrder(orderedMatchers: SignalMatcher[]): R;
}

declare module "vitest" {
	interface Assertion<T> extends OpenHarnessMatchers<T>, SignalMatchers<T> {}
	interface AsymmetricMatchersContaining extends OpenHarnessMatchers, SignalMatchers {}
}
