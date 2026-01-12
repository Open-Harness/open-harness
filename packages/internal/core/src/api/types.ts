/**
 * Public API types for Open Harness v0.3.0
 *
 * These types form the primary interface for users:
 * - agent() creates an Agent
 * - workflow() creates a Workflow
 * - createWorkflow() creates a typed workflow factory (v0.3.0)
 * - runReactive() executes signal-based workflows (v0.3.0)
 *
 * Design decisions documented in SDK_DX_DECISIONS.md
 */

import type { ZodType } from "zod";

// v0.3.0 Signal-based types
import type { Signal, Harness } from "@internal/signals-core";
import type { SignalPattern, SignalStore } from "@internal/signals";

// Re-export Harness from @internal/signals-core for convenience
export type { Harness } from "@internal/signals-core";

/**
 * Standard agent input shape.
 */
export type AgentInput = {
	prompt?: string;
	messages?: unknown[];
	sessionId?: string;
	options?: Record<string, unknown>;
};

/**
 * Standard agent output shape.
 */
export type AgentOutput = {
	text?: string;
	structuredOutput?: unknown;
	usage?: { inputTokens: number; outputTokens: number };
	totalCostUsd?: number;
	durationMs?: number;
	sessionId?: string;
};

// ============================================================================
// FixtureStore - Public alias for SignalStore
// ============================================================================

/**
 * Store for fixtures (signal recordings).
 *
 * Public API uses "fixture" terminology while internals use SignalStore.
 * v0.3.0: Migrated from old RecordingStore to signal-based SignalStore.
 * See SDK_DX_DECISIONS.md Decision #11.
 */
export type FixtureStore = SignalStore;

// ============================================================================
// Agent types
// ============================================================================

/**
 * Configuration for creating an agent.
 *
 * Agents are stateless - state lives on the workflow level.
 * Agents are guard-less - use specific signal patterns or workflow edges for control flow.
 *
 * @property prompt - System prompt defining agent behavior
 * @property output - Optional output configuration with schema
 *
 * v0.3.0 adds reactive properties:
 * @property activateOn - Signal patterns that trigger this agent
 * @property emits - Signals this agent declares it will emit
 * @property signalHarness - Per-agent signal-based harness override
 */
export type AgentConfig<TOutput = unknown> = {
	/**
	 * System prompt that defines the agent's behavior.
	 * This is the core identity of the agent.
	 */
	prompt: string;

	/**
	 * Optional output configuration.
	 * When provided, agent output will be validated/parsed.
	 */
	output?: {
		/**
		 * Zod schema for structured output validation.
		 */
		schema?: ZodType<TOutput>;
	};

	// ==========================================================================
	// v0.3.0 Reactive Properties
	// ==========================================================================

	/**
	 * Signal patterns that trigger this agent.
	 * Uses glob syntax: "workflow:start", "state:*:changed", "trade:**"
	 *
	 * When present, makes this a "reactive agent" that can be used with runReactive().
	 *
	 * @example
	 * ```ts
	 * activateOn: ["workflow:start"]
	 * activateOn: ["analysis:complete", "data:updated"]
	 * activateOn: ["state:*:changed"]
	 * ```
	 */
	activateOn?: SignalPattern[];

	/**
	 * Signals this agent declares it will emit.
	 * Declarative metadata - helps with workflow visualization and debugging.
	 * These signals are automatically emitted after agent completion.
	 *
	 * @example
	 * ```ts
	 * emits: ["analysis:complete"]
	 * emits: ["trade:proposed", "trade:executed"]
	 * ```
	 */
	emits?: string[];

	/**
	 * Per-agent signal-based harness override (v0.3.0).
	 * If not set, uses default harness from runReactive options.
	 *
	 * @example
	 * ```ts
	 * import { ClaudeHarness } from "@open-harness/claude"
	 * signalHarness: new ClaudeHarness()
	 * ```
	 */
	signalHarness?: Harness;
};

/**
 * An agent definition created by the agent() function.
 *
 * Agents are stateless building blocks - they have identity,
 * make decisions, but do not maintain state.
 * State lives on the workflow level.
 */
export type Agent<TOutput = unknown> = {
	/**
	 * Discriminator for type checking at runtime.
	 */
	readonly _tag: "Agent";

	/**
	 * The configuration used to create this agent.
	 */
	readonly config: AgentConfig<TOutput>;
};

/**
 * A reactive agent is an agent with activation rules.
 * Can be run in a reactive context via runReactive().
 *
 * An agent becomes reactive when it has `activateOn` defined.
 */
export type ReactiveAgent<TOutput = unknown> = Agent<TOutput> & {
	/**
	 * Indicates this agent has reactive capabilities.
	 * Set automatically when activateOn is present.
	 */
	readonly _reactive: true;
};

// ============================================================================
// Run types
// ============================================================================

/**
 * Execution mode for fixtures.
 *
 * - 'record': Execute live and save fixture
 * - 'replay': Load fixture and replay (no LLM calls)
 * - 'live': Execute live without recording (default)
 */
export type FixtureMode = "record" | "replay" | "live";

/**
 * Options for running an agent or workflow.
 *
 * See SDK_DX_DECISIONS.md Decision #9.
 */
export type RunOptions = {
	/**
	 * Fixture identifier for recording/replay.
	 * When provided, enables fixture-based testing.
	 *
	 * For multi-agent workflows, produces hierarchical IDs:
	 * `<fixture>/<agentId>/inv<N>`
	 *
	 * @example "my-test"
	 * @example "integration/code-review"
	 */
	fixture?: string;

	/**
	 * Execution mode for fixtures.
	 *
	 * Can also be set via FIXTURE_MODE environment variable.
	 * Explicit option takes precedence over env var.
	 *
	 * @default "live"
	 */
	mode?: FixtureMode;

	/**
	 * Store for saving/loading fixtures.
	 * Required when fixture is specified.
	 */
	store?: FixtureStore;

	/**
	 * Variant identifier for A/B testing scenarios.
	 * Passed through to harness for tagging.
	 */
	variant?: string;

	/**
	 * Harness for executing agents.
	 *
	 * If not specified, uses the default harness set via setDefaultHarness().
	 * If no default is set, throws an error.
	 *
	 * @example
	 * ```ts
	 * import { createClaudeNode } from "@open-harness/server"
	 *
	 * await run(myAgent, input, { harness: createClaudeNode() })
	 * ```
	 */
	harness?: Harness;
};

/**
 * Metrics collected during a run.
 */
export type RunMetrics = {
	/**
	 * Total execution time in milliseconds.
	 */
	latencyMs: number;

	/**
	 * Total cost in USD (from harness pricing).
	 */
	cost: number;

	/**
	 * Token usage breakdown.
	 */
	tokens: {
		/**
		 * Input tokens consumed.
		 */
		input: number;

		/**
		 * Output tokens generated.
		 */
		output: number;
	};
};

/**
 * Result of running an agent or workflow.
 *
 * See SDK_DX_DECISIONS.md Decision #12.
 *
 * @template T - Type of the output
 */
export type RunResult<T = unknown> = {
	/**
	 * The output produced by the agent/workflow.
	 */
	output: T;

	/**
	 * Workflow state (if applicable).
	 * For workflows, this is the shared workflow state.
	 * Single agents do not have state.
	 */
	state?: Record<string, unknown>;

	/**
	 * Metrics collected during execution.
	 */
	metrics: RunMetrics;

	/**
	 * IDs of fixtures created (when recording).
	 * Empty array when not recording.
	 *
	 * For multi-agent workflows, contains hierarchical IDs.
	 */
	fixtures?: string[];
};

// ============================================================================
// Type guards
// ============================================================================

/**
 * Type guard to check if a value is an Agent.
 */
export function isAgent(value: unknown): value is Agent {
	return (
		typeof value === "object" &&
		value !== null &&
		"_tag" in value &&
		value._tag === "Agent"
	);
}

/**
 * Type guard to check if a value is a ReactiveAgent.
 * An agent is reactive when it has activateOn defined.
 */
export function isReactiveAgent(value: unknown): value is ReactiveAgent {
	return isAgent(value) && "_reactive" in value && value._reactive === true;
}

// ============================================================================
// Logging types (v3.1)
// ============================================================================

/**
 * Logging configuration for runReactive.
 *
 * Default (batteries included):
 * - console: true - see what's happening
 * - file: false - opt-in for persistence
 * - level: "info" - lifecycle events
 * - logDir: ".open-harness/logs"
 */
export type LoggingConfig = {
	/**
	 * Enable console output (pretty printed).
	 * @default true
	 */
	console?: boolean;

	/**
	 * Enable file output (JSONL format).
	 * @default false
	 */
	file?: boolean;

	/**
	 * Minimum log level.
	 * @default "info"
	 */
	level?: "trace" | "debug" | "info" | "warn" | "error";

	/**
	 * Log directory for file output.
	 * @default ".open-harness/logs"
	 */
	logDir?: string;
};
