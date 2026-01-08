/**
 * Public API for Open Harness v0.2.0
 *
 * This module exports the primary user-facing API:
 *
 * - `agent()` - Create an agent definition
 * - `harness()` - Create a multi-agent harness
 * - `run()` - Execute an agent or harness
 * - `setDefaultStore()`, `setDefaultMode()` - Configure defaults
 *
 * @example
 * ```ts
 * import { agent, harness, run } from "@open-harness/core"
 *
 * const myAgent = agent({ prompt: "You are helpful." })
 * const result = await run(myAgent, { prompt: "Hello!" })
 * ```
 */

// Types
export type {
	Agent,
	AgentConfig,
	Harness,
	HarnessConfig,
	Edge,
	RunOptions,
	RunResult,
	RunMetrics,
	FixtureStore,
	FixtureMode,
} from "./types.js";

// Type guards
export { isAgent, isHarness } from "./types.js";

// Factory functions
export { agent } from "./agent.js";
export { harness, type HarnessWithFlow } from "./harness.js";

// Execution
export { run, generateFixtureId } from "./run.js";

// Defaults
export {
	setDefaultStore,
	getDefaultStore,
	setDefaultMode,
	getDefaultMode,
	resetDefaults,
} from "./defaults.js";
