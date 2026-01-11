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
 * // tests/my-agent.test.ts (v0.3.0)
 * import { test, expect } from 'vitest'
 * import { createWorkflow, ClaudeHarness, MemorySignalStore } from '@open-harness/vitest'
 *
 * const { agent, runReactive } = createWorkflow<{ input: string }>()
 *
 * test('agent responds quickly and cheaply', async () => {
 *   const myAgent = agent({
 *     prompt: 'You are helpful. Input: {{ state.input }}',
 *     activateOn: ['workflow:start'],
 *   })
 *
 *   const result = await runReactive({
 *     agents: { myAgent },
 *     state: { input: 'Hello' },
 *     defaultHarness: new ClaudeHarness(),
 *   })
 *
 *   expect(result.state).toBeDefined()
 *   expect(result.metrics.durationMs).toBeLessThan(5000)
 * })
 * ```
 *
 * @packageDocumentation
 */

// Matchers
export { matchers, type SignalMatcher, setupMatchers, signalMatchers } from "./matchers.js";
export type { GateConfig } from "./reporter.js";
// Reporter
export { OpenHarnessReporter } from "./reporter.js";

// Types (re-export for type augmentation)
import "./types.js";

// Convenience re-exports from core (v0.3.0)
export {
	agent,
	ClaudeHarness,
	createWorkflow,
	MemorySignalStore,
	type RunReactiveOptions,
	type RunReactiveResult,
	runReactive,
} from "@open-harness/core";
