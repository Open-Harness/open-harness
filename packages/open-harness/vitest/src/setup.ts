/**
 * Auto-setup file for Open Harness Vitest matchers.
 *
 * Include this in your vitest.config.ts setupFiles to automatically
 * register custom matchers:
 *
 * @example
 * ```ts
 * // vitest.config.ts
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['@open-harness/vitest/setup'],
 *   }
 * })
 * ```
 *
 * Alternatively, call setupMatchers() manually in your tests:
 *
 * @example
 * ```ts
 * import { setupMatchers } from '@open-harness/vitest'
 * setupMatchers()
 * ```
 */
import { setupMatchers } from "./matchers.js";

// Auto-register matchers when used as setupFile
setupMatchers();
