/**
 * @open-scaffold/testing
 *
 * Shared testing utilities and recordings for Open Scaffold packages.
 *
 * Provides:
 * - Pre-recorded API sessions for deterministic playback testing
 * - Test server setup helpers
 * - Future: Custom Vitest reporters
 *
 * @module
 */

import * as path from "node:path"
import { fileURLToPath } from "node:url"

// ─────────────────────────────────────────────────────────────────
// Recordings Database
// ─────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Absolute path to the shared recordings database.
 *
 * This database contains pre-recorded provider responses for deterministic
 * playback testing across all packages.
 *
 * @example
 * ```typescript
 * import { recordingsDbPath } from "@open-scaffold/testing"
 * import { ProviderRecorderLive } from "@open-scaffold/server"
 *
 * const recorder = ProviderRecorderLive({ url: `file:${recordingsDbPath}` })
 * ```
 */
export const recordingsDbPath = path.resolve(__dirname, "../recordings/test.db")

/**
 * SQLite URL for the recordings database.
 *
 * @example
 * ```typescript
 * import { recordingsDbUrl } from "@open-scaffold/testing"
 *
 * const scaffold = OpenScaffold.create({
 *   database: recordingsDbUrl,
 *   mode: "playback"
 * })
 * ```
 */
export const recordingsDbUrl = `file:${recordingsDbPath}`

// ─────────────────────────────────────────────────────────────────
// Test Server Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Get a random port in the high range for test servers.
 * Avoids conflicts with common development ports.
 */
export const getRandomPort = (): number => 30000 + Math.floor(Math.random() * 10000)

// ─────────────────────────────────────────────────────────────────
// Re-exports for convenience
// ─────────────────────────────────────────────────────────────────

// These will be added as the package grows:
// - Custom Vitest matchers
// - Test fixtures
// - Reporter utilities
