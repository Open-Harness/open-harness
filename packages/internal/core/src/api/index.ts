/**
 * Public API for Open Harness v0.3.0
 *
 * This module exports the primary user-facing API:
 *
 * - `agent()` - Create an agent definition
 * - `createWorkflow()` - Create a typed workflow factory
 * - `runReactive()` - Execute signal-based workflows
 *
 * @example
 * ```ts
 * import { createWorkflow, ClaudeHarness } from "@open-harness/core"
 *
 * const { agent, runReactive } = createWorkflow<MyState>()
 *
 * const analyzer = agent({
 *   prompt: "Analyze: {{ state.input }}",
 *   activateOn: ["workflow:start"],
 *   emits: ["analysis:complete"],
 * })
 *
 * const result = await runReactive({
 *   agents: { analyzer },
 *   state: initialState,
 *   defaultHarness: new ClaudeHarness(),
 * })
 * ```
 */

// Types
export type {
	Agent,
	AgentConfig,
	AgentInput,
	AgentOutput,
	RunResult,
	RunMetrics,
	FixtureStore,
	FixtureMode,
	Harness,
	// v0.3.0 Reactive types
	ReactiveAgent,
	// v3.1 Logging config
	LoggingConfig,
} from "./types.js";

// Type guards
export { isAgent, isReactiveAgent } from "./types.js";

// Factory functions
export { agent } from "./agent.js";

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
	setDefaultHarness,
	getDefaultHarness,
	resetDefaults,
} from "./defaults.js";

// v0.3.0 Workflow Factory (solves variance problem)
export {
	createWorkflow,
	TimeoutError,
	type ActivationContext,
	type ReactiveAgentConfig,
	type ScopedReactiveAgent,
	type ReactiveWorkflowConfig,
	type ReactiveWorkflowResult,
	type WorkflowFactory,
	// v0.3.1 CQRS Pattern Types
	type SignalReducer,
	type SignalReducers,
	type ProcessManager,
	type ProcessManagers,
} from "./create-workflow.js";

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
	type WorkflowWideEvent,
	type WorkflowStartEvent,
	type WorkflowErrorEvent,
	type WorkflowEvent,
	type WorkflowOutcome,
	type TokenUsage,
	type CostBreakdown,
	type SamplingConfig,
} from "./telemetry.js";
