/**
 * Open Harness Vitest Plugin
 *
 * Custom matchers and reporters for testing AI agents with Vitest.
 *
 * @example
 * ```ts
 * // vitest.config.ts
 * import { defineConfig } from 'vitest/config'
 * import { OpenHarnessReporter } from '@open-harness/vitest'
 *
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['@open-harness/vitest/setup'],
 *     reporters: ['default', new OpenHarnessReporter({ passRate: 0.8 })],
 *   }
 * })
 * ```
 *
 * @example
 * ```ts
 * // tests/my-agent.test.ts
 * import { test, expect } from 'vitest'
 * import { run, agent } from '@open-harness/vitest'
 *
 * const myAgent = agent({ prompt: 'You are helpful.' })
 *
 * test('agent responds quickly and cheaply', async () => {
 *   const result = await run(myAgent, { prompt: 'Hello' })
 *
 *   expect(result.output).toBeDefined()
 *   expect(result).toHaveLatencyUnder(5000)  // < 5 seconds
 *   expect(result).toCostUnder(0.01)         // < $0.01
 *   expect(result).toHaveTokensUnder(1000)   // < 1000 total tokens
 * })
 * ```
 *
 * @packageDocumentation
 */

// Matchers
export { matchers, setupMatchers } from "./matchers.js";
export type { GateConfig } from "./reporter.js";
// Reporter
export { OpenHarnessReporter } from "./reporter.js";

// Types (re-export for type augmentation)
import "./types.js";

// Convenience re-exports from core
export type { RunMetrics, RunResult } from "@open-harness/core";
export { agent, harness, run } from "@open-harness/core";
