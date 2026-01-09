/**
 * Shared test utilities for SpecKit examples.
 *
 * Provides fixture configuration that works across all example levels.
 * Import this in any test file that uses fixtures.
 *
 * @example
 * ```ts
 * import { setupFixtures, withFixture } from "../test-utils";
 *
 * beforeAll(() => {
 *   setupFixtures();
 * });
 *
 * it("runs with fixture", async () => {
 *   const result = await run(myAgent, input, withFixture("my-test"));
 * });
 * ```
 */

import { FileRecordingStore } from "@open-harness/stores";
import {
	setDefaultStore,
	setDefaultMode,
	type FixtureMode,
} from "@open-harness/core";

/**
 * Single fixture store for all examples.
 * Fixtures are stored in examples/speckit/fixtures/
 */
export const fixtureStore = new FileRecordingStore({
	directory: "./fixtures",
});

/**
 * Configure fixtures for testing.
 *
 * Call this in beforeAll() of any test file that uses fixtures.
 * Sets up the default store and mode so run() uses fixtures automatically.
 *
 * Mode priority:
 * 1. FIXTURE_MODE env var (for CI/scripts)
 * 2. "replay" (default when no env var)
 *
 * @example
 * ```ts
 * beforeAll(() => {
 *   setDefaultProvider(createClaudeNode());
 *   setupFixtures();
 * });
 * ```
 */
export function setupFixtures(): void {
	setDefaultStore(fixtureStore);

	// Default to "replay" unless FIXTURE_MODE env var is set
	// This makes tests fast and free by default
	if (!process.env.FIXTURE_MODE) {
		setDefaultMode("replay");
	}
}

/**
 * Helper to create fixture options for a specific test.
 *
 * Use this when you want to explicitly specify a fixture name.
 * The store is automatically included from the shared fixtureStore.
 *
 * @param name - Unique fixture name for this test
 * @returns RunOptions with fixture and store configured
 *
 * @example
 * ```ts
 * const result = await run(myAgent, input, withFixture("email-validation"));
 * ```
 */
export function withFixture(name: string): { fixture: string; store: typeof fixtureStore } {
	return {
		fixture: name,
		store: fixtureStore,
	};
}
