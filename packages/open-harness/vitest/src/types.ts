/**
 * TypeScript declarations for Open Harness Vitest matchers.
 *
 * These declarations augment Vitest's Assertion interface to provide
 * type-safe autocomplete for custom matchers.
 */

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

declare module "vitest" {
	interface Assertion<T> extends OpenHarnessMatchers<T> {}
	interface AsymmetricMatchersContaining extends OpenHarnessMatchers {}
}
