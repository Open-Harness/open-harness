/**
 * Public API for Open Harness v0.3.0
 *
 * This module exports the primary user-facing API:
 *
 * - `agent()` - Create an agent definition
 * - `createHarness()` - Create a typed harness factory
 * - `runReactive()` - Execute signal-based workflows
 *
 * @example
 * ```ts
 * import { createHarness, ClaudeProvider } from "@open-harness/core"
 *
 * const { agent, runReactive } = createHarness<MyState>()
 *
 * const analyzer = agent({
 *   prompt: "Analyze: {{ state.input }}",
 *   activateOn: ["harness:start"],
 *   emits: ["analysis:complete"],
 * })
 *
 * const result = await runReactive({
 *   agents: { analyzer },
 *   state: initialState,
 *   defaultProvider: new ClaudeProvider(),
 * })
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
	// RunOptions removed (v0.3.0) - use RunReactiveOptions instead
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

// Execution (v0.3.0 - signal-based)
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
