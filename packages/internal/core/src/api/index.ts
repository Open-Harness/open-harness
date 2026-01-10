/**
 * Public API for Open Harness
 *
 * This module exports the primary user-facing API:
 *
 * v0.2.0:
 * - `agent()` - Create an agent definition
 * - `harness()` - Create a multi-agent harness
 * - `run()` - Execute an agent or harness
 * - `setDefaultStore()`, `setDefaultMode()` - Configure defaults
 *
 * v0.3.0 (Reactive):
 * - `runReactive()` - Execute a reactive agent in a signal-driven environment
 * - `ReactiveAgent` - Agent with activateOn/emits
 *
 * @example
 * ```ts
 * import { agent, harness, run } from "@open-harness/core"
 *
 * const myAgent = agent({ prompt: "You are helpful." })
 * const result = await run(myAgent, { prompt: "Hello!" })
 *
 * // Reactive agent (v0.3.0)
 * const reactive = agent({
 *   prompt: "Analyze data.",
 *   activateOn: ["harness:start"],
 *   emits: ["analysis:complete"],
 * })
 * const result = await runReactive(reactive, { data: "..." })
 * ```
 */

// Types
export type {
	Agent,
	AgentConfig,
	AgentInput,
	AgentOutput,
	Harness,
	HarnessConfig,
	Edge,
	RunOptions,
	RunResult,
	RunMetrics,
	FixtureStore,
	FixtureMode,
	Provider,
	// v0.3.0 Reactive types
	ReactiveAgent,
} from "./types.js";

// Type guards
export { isAgent, isHarness, isReactiveAgent } from "./types.js";

// Factory functions
export { agent } from "./agent.js";
export { harness, type HarnessWithFlow } from "./harness.js";

// Execution (v0.2.0)
export { run, generateFixtureId } from "./run.js";

// Execution (v0.3.0 Reactive)
export {
	runReactive,
	type RunReactiveOptions,
	type RunReactiveResult,
	type SignalRecordingMode,
	type SignalRecordingOptions,
} from "./run-reactive.js";

// Defaults
export {
	setDefaultStore,
	getDefaultStore,
	setDefaultMode,
	getDefaultMode,
	setDefaultProvider,
	getDefaultProvider,
	resetDefaults,
} from "./defaults.js";

// v0.3.0 Harness Factory (solves variance problem)
export {
	createHarness,
	TimeoutError,
	type ActivationContext,
	type ReactiveAgentConfig,
	type ScopedReactiveAgent,
	type ReactiveHarnessConfig,
	type ReactiveHarnessResult,
	type HarnessFactory,
} from "./create-harness.js";

// v0.3.0 Template Engine (F2)
export {
	expandTemplate,
	hasTemplateExpressions,
	extractPaths,
	type TemplateContext,
} from "./template.js";

// v0.3.0 Debug Utilities (E1)
export {
	getCausalityChain,
	getAgentSignals,
	getChildSignals,
	buildSignalTree,
	formatSignalTree,
	getSignalSummary,
	filterSignals,
	type SignalNode,
} from "./debug.js";

// v0.3.0 Reactive Store (E2)
export {
	createReactiveStore,
	connectStoreToBus,
	type StateChangePayload,
	type StateChangeHandler,
	type ReactiveStore,
} from "./reactive-store.js";

// v0.3.0 Telemetry - Wide Events (E5)
export {
	createTelemetrySubscriber,
	createWideEvent,
	type TelemetryConfig,
	type TelemetrySubscriber,
	type TelemetryInput,
	type HarnessWideEvent,
	type HarnessStartEvent,
	type HarnessErrorEvent,
	type HarnessEvent,
	type HarnessOutcome,
	type TokenUsage,
	type CostBreakdown,
	type SamplingConfig,
} from "./telemetry.js";
