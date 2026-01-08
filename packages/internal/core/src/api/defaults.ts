/**
 * Global defaults for Open Harness execution.
 *
 * These functions allow setting default values for fixture store and mode
 * that will be used when not explicitly provided in run() options.
 *
 * @example
 * ```ts
 * import { setDefaultStore, setDefaultMode } from "@open-harness/core"
 *
 * // In test setup
 * setDefaultStore(new FileFixtureStore("./fixtures"))
 * setDefaultMode("replay")
 *
 * // Now run() will use these defaults
 * await run(myAgent, input)  // Uses default store and mode
 * ```
 */

import type { FixtureStore, FixtureMode } from "./types.js";

// ============================================================================
// Global state
// ============================================================================

let defaultStore: FixtureStore | undefined;
let defaultMode: FixtureMode | undefined;

// ============================================================================
// Store defaults
// ============================================================================

/**
 * Set the default fixture store.
 *
 * When set, this store will be used by run() when no store is
 * explicitly provided in options.
 *
 * @param store - The fixture store to use as default, or undefined to clear
 *
 * @example
 * ```ts
 * // Set default store
 * setDefaultStore(new FileFixtureStore("./fixtures"))
 *
 * // Clear default store
 * setDefaultStore(undefined)
 * ```
 */
export function setDefaultStore(store: FixtureStore | undefined): void {
	defaultStore = store;
}

/**
 * Get the current default fixture store.
 *
 * @returns The default fixture store, or undefined if not set
 *
 * @example
 * ```ts
 * const store = getDefaultStore()
 * if (store) {
 *   console.log("Default store is configured")
 * }
 * ```
 */
export function getDefaultStore(): FixtureStore | undefined {
	return defaultStore;
}

// ============================================================================
// Mode defaults
// ============================================================================

/**
 * Set the default fixture mode.
 *
 * When set, this mode will be used by run() when no mode is
 * explicitly provided in options and FIXTURE_MODE env var is not set.
 *
 * Priority order:
 * 1. Explicit option in run()
 * 2. FIXTURE_MODE env var
 * 3. Default mode (this function)
 * 4. "live"
 *
 * @param mode - The fixture mode to use as default, or undefined to clear
 *
 * @example
 * ```ts
 * // Set default mode
 * setDefaultMode("replay")
 *
 * // Clear default mode
 * setDefaultMode(undefined)
 * ```
 */
export function setDefaultMode(mode: FixtureMode | undefined): void {
	defaultMode = mode;
}

/**
 * Get the current default fixture mode.
 *
 * Returns the default mode if set, otherwise returns "live".
 * Note: This does NOT check FIXTURE_MODE env var - that's done in run().
 *
 * @returns The default fixture mode
 *
 * @example
 * ```ts
 * const mode = getDefaultMode()
 * console.log(`Default mode is: ${mode}`)
 * ```
 */
export function getDefaultMode(): FixtureMode {
	return defaultMode ?? "live";
}

// ============================================================================
// Reset (for testing)
// ============================================================================

/**
 * Reset all defaults to initial state.
 *
 * Useful for testing to ensure clean state between tests.
 *
 * @internal
 */
export function resetDefaults(): void {
	defaultStore = undefined;
	defaultMode = undefined;
}
