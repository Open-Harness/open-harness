/**
 * Public API types for Open Harness v0.2.0
 *
 * These types form the primary interface for users:
 * - agent() creates an Agent
 * - harness() creates a Harness
 * - run() executes either and returns RunResult
 *
 * Design decisions documented in SDK_DX_DECISIONS.md
 */

import type { RecordingStore } from "../recording/store.js";
import type { ZodType } from "zod";

// ============================================================================
// FixtureStore - Public alias for RecordingStore
// ============================================================================

/**
 * Store for fixtures (recordings).
 *
 * Public API uses "fixture" terminology while internals use "recording".
 * See SDK_DX_DECISIONS.md Decision #11.
 */
export type FixtureStore = RecordingStore;

// ============================================================================
// Agent types
// ============================================================================

/**
 * Configuration for creating an agent.
 *
 * @property prompt - System prompt defining agent behavior
 * @property state - Optional initial state for stateful agents
 * @property output - Optional output configuration with schema
 */
export type AgentConfig<TOutput = unknown, TState = Record<string, unknown>> = {
	/**
	 * System prompt that defines the agent's behavior.
	 * This is the core identity of the agent.
	 */
	prompt: string;

	/**
	 * Optional initial state for stateful agents.
	 * State persists across invocations within a run.
	 *
	 * @example
	 * ```ts
	 * state: { conversationHistory: [], taskCount: 0 }
	 * ```
	 */
	state?: TState;

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
};

/**
 * An agent definition created by the agent() function.
 *
 * Agents are the fundamental building blocks - they have identity,
 * make decisions, and optionally maintain state.
 */
export type Agent<TOutput = unknown, TState = Record<string, unknown>> = {
	/**
	 * Discriminator for type checking at runtime.
	 */
	readonly _tag: "Agent";

	/**
	 * The configuration used to create this agent.
	 */
	readonly config: AgentConfig<TOutput, TState>;
};

// ============================================================================
// Harness types
// ============================================================================

/**
 * Edge definition for connecting agents in a harness.
 *
 * Edges define control flow - which agent runs after which,
 * and under what conditions.
 */
export type Edge = {
	/**
	 * Source agent identifier.
	 */
	from: string;

	/**
	 * Target agent identifier.
	 */
	to: string;

	/**
	 * Optional condition for when this edge fires.
	 * Uses JSONata expression syntax.
	 *
	 * @example "status = 'needs_review'"
	 * @example "$exists(errors) and $count(errors) > 0"
	 */
	when?: string;
};

/**
 * Configuration for creating a harness.
 *
 * @property agents - Named agents that comprise this harness
 * @property edges - Connections between agents
 * @property state - Optional shared state accessible to all agents
 */
export type HarnessConfig<TState = Record<string, unknown>> = {
	/**
	 * Named agents that comprise this harness.
	 *
	 * @example
	 * ```ts
	 * agents: {
	 *   coder: agent({ prompt: "You are a coder" }),
	 *   reviewer: agent({ prompt: "You are a reviewer" }),
	 * }
	 * ```
	 */
	agents: Record<string, Agent>;

	/**
	 * Edges defining control flow between agents.
	 */
	edges: Edge[];

	/**
	 * Optional shared state accessible to all agents.
	 */
	state?: TState;
};

/**
 * A harness definition created by the harness() function.
 *
 * Harnesses coordinate multiple agents - they own shared state,
 * decide which agent runs next, and coordinate recordings.
 *
 * The harness doesn't "execute" - agents execute. The harness coordinates.
 * See SDK_DX_DECISIONS.md Decision #8.
 */
export type Harness<TState = Record<string, unknown>> = {
	/**
	 * Discriminator for type checking at runtime.
	 */
	readonly _tag: "Harness";

	/**
	 * The configuration used to create this harness.
	 */
	readonly config: HarnessConfig<TState>;
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
 * Options for running an agent or harness.
 *
 * See SDK_DX_DECISIONS.md Decision #9.
 */
export type RunOptions = {
	/**
	 * Fixture identifier for recording/replay.
	 * When provided, enables fixture-based testing.
	 *
	 * For multi-agent harnesses, produces hierarchical IDs:
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
	 * Passed through to provider for tagging.
	 */
	variant?: string;
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
	 * Total cost in USD (from provider pricing).
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
 * Result of running an agent or harness.
 *
 * See SDK_DX_DECISIONS.md Decision #12.
 *
 * @template T - Type of the output
 */
export type RunResult<T = unknown> = {
	/**
	 * The output produced by the agent/harness.
	 */
	output: T;

	/**
	 * Harness workflow state (if applicable).
	 * For single agents, this reflects agent state if configured.
	 * For harnesses, this is the shared workflow state.
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
	 * For multi-agent harnesses, contains hierarchical IDs.
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
 * Type guard to check if a value is a Harness.
 */
export function isHarness(value: unknown): value is Harness {
	return (
		typeof value === "object" &&
		value !== null &&
		"_tag" in value &&
		value._tag === "Harness"
	);
}
