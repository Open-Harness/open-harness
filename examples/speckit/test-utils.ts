/**
 * Shared test utilities for SpecKit examples.
 *
 * v0.3.0 Reactive Pattern - Recording Configuration
 *
 * In v0.3.0, recording config is passed directly to runReactive():
 *
 * @example
 * ```ts
 * import { MemorySignalStore } from "@open-harness/core";
 *
 * // Shared store for recording/replay
 * const store = new MemorySignalStore();
 *
 * // Get mode from environment
 * const getMode = () =>
 *   (process.env.FIXTURE_MODE === "record" ? "record" : "replay");
 *
 * // In your test
 * const result = await runSpecKit(prompt, {
 *   fixture: "my-test",
 *   mode: getMode(),
 *   store,
 * });
 * ```
 *
 * Key differences from old API:
 * - No global `setDefaultStore()` or `setDefaultMode()`
 * - Recording config passed to each `runReactive()` call
 * - `MemorySignalStore` for in-memory fixtures
 * - Each test controls its own recording behavior
 *
 * Benefits:
 * - Explicit over implicit - config visible at call site
 * - No global state to manage
 * - Tests can use different stores if needed
 * - Clear signal-based recording semantics
 */

import { MemorySignalStore } from "@open-harness/core";

/**
 * Create a fixture configuration helper.
 *
 * @example
 * ```ts
 * const { fixture, getMode, store } = createFixtureHelper();
 *
 * const result = await runSpecKit(prompt, fixture("my-test"));
 * ```
 */
export function createFixtureHelper() {
	const store = new MemorySignalStore();

	const getMode = () => (process.env.FIXTURE_MODE === "record" ? "record" : "replay") as "record" | "replay";

	const fixture = (name: string) => ({
		fixture: name,
		mode: getMode(),
		store,
	});

	return { fixture, getMode, store };
}

/**
 * Standard fixture options type for run functions.
 */
export interface FixtureOptions {
	fixture?: string;
	mode?: "record" | "replay";
	store?: MemorySignalStore;
}

/**
 * Helper to get recording mode from environment.
 *
 * @example
 * ```ts
 * const mode = getRecordingMode();
 * // Returns "record" if FIXTURE_MODE=record, else "replay"
 * ```
 */
export function getRecordingMode(): "record" | "replay" {
	return process.env.FIXTURE_MODE === "record" ? "record" : "replay";
}
