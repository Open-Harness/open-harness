/**
 * defineHarness Factory - Fluent API for creating harnesses
 *
 * Provides a clean factory function for defining harnesses with:
 * - Typed agent access
 * - State factory pattern
 * - Declarative event handling
 * - Auto-cleanup on completion
 *
 * @module factory/define-harness
 */

import { createContainer } from "../infra/container.js";
import { IUnifiedEventBusToken } from "../infra/tokens.js";
import type { Attachment, IUnifiedEventBus } from "../infra/unified-events/types.js";
import type {
	FluentEventHandler,
	FluentHarnessEvent,
	HarnessEventType,
	ParallelOptions,
	RetryOptions,
	StepYield,
} from "../harness/event-types.js";
import { HarnessInstance as HarnessInstanceImpl } from "../harness/harness-instance.js";

// Type-only import for AgentBuilder (used in dynamic import)
// biome-ignore lint/suspicious/noExplicitAny: Type declaration for dynamic import
type AgentBuilderType = new (...args: any[]) => { build: (def: unknown) => unknown };

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Base constraint for agent constructors.
 * Any class that can be instantiated is accepted.
 * This is intentionally loose to allow full type inference.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for flexible agent typing
export type AgentConstructor<T = any> = new (...args: unknown[]) => T;

/**
 * Agent definition from providers (e.g., AnthropicAgentDefinition).
 * Matches the shape of objects returned by defineAnthropicAgent().
 */
export interface AgentDefinition {
	name: string;
	prompt: unknown;
	[key: string]: unknown;
}

/**
 * Union type for agents - accepts both classes and definitions.
 */
export type Agent = AgentConstructor | AgentDefinition;

/**
 * Type helper: converts agent record to resolved instance record.
 * Handles both agent constructors (classes) and agent definitions (config objects).
 *
 * For agent constructors: extracts InstanceType
 * For agent definitions: resolves to ExecutableAgent (runtime type)
 */
// biome-ignore lint/suspicious/noExplicitAny: Required to accept any agent shape
export type ResolvedAgents<T extends Record<string, Agent>> = {
	[K in keyof T]: T[K] extends AgentConstructor<infer R>
		? R
		: T[K] extends AgentDefinition
			? { execute: (...args: any[]) => Promise<any>; stream: (...args: any[]) => any }
			: never;
};

/**
 * Context passed to both run() and execute() functions.
 * Provides access to agents, state, and event helpers.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for flexible agent typing
export interface ExecuteContext<TAgents extends Record<string, Agent>, TState> {
	/** Resolved agent instances (not constructors) */
	agents: ResolvedAgents<TAgents>;

	/** Mutable state object */
	state: TState;

	/**
	 * Phase helper - wraps work with auto start/complete events.
	 * Emits phase:start before, phase:complete after (with return value).
	 */
	phase: <T>(name: string, fn: () => Promise<T>) => Promise<T>;

	/**
	 * Task helper - wraps work with auto start/complete/failed events.
	 * Emits task:start before, task:complete or task:failed after.
	 */
	task: <T>(id: string, fn: () => Promise<T>) => Promise<T>;

	/** Escape hatch for custom events not covered by helpers */
	emit: (type: string, data: Record<string, unknown>) => void;

	/**
	 * Retry helper with auto-emitted events.
	 * Emits: retry:start, retry:attempt, retry:backoff, retry:success, retry:failure
	 */
	retry: <T>(name: string, fn: () => Promise<T>, options?: RetryOptions) => Promise<T>;

	/**
	 * Parallel execution helper with auto-emitted events.
	 * Emits: parallel:start, parallel:item:complete, parallel:complete
	 */
	parallel: <T>(name: string, fns: Array<() => Promise<T>>, options?: ParallelOptions) => Promise<T[]>;
}

/**
 * Configuration for defineHarness().
 * Supports both run: (simple) and execute: (generator) patterns.
 * These are mutually exclusive.
 */
export interface HarnessConfig<
	// biome-ignore lint/suspicious/noExplicitAny: Required for flexible agent typing
	TAgents extends Record<string, Agent>,
	TState = Record<string, never>,
	TInput = void,
	TResult = void,
> {
	/** Optional harness name for debugging/logging. Default: 'anonymous-harness' */
	name?: string;

	/** Execution mode. Default: 'live' */
	mode?: "live" | "replay";

	/** Agent constructors to resolve and inject */
	agents: TAgents;

	/** State factory function. Default: () => ({}) */
	state?: (input: TInput) => TState;

	/** Simple async function execution (no generator) */
	run?: (context: ExecuteContext<TAgents, TState>, input: TInput) => Promise<TResult>;

	/** Generator execution with step recording via yields */
	execute?: (context: ExecuteContext<TAgents, TState>) => AsyncGenerator<StepYield, TResult>;

	/**
	 * Pre-registered attachments (T058).
	 * These attachments are applied to every instance created by this factory.
	 * Use for environment-based configuration (debug logging, metrics, etc.).
	 */
	attachments?: Attachment[];
}

/**
 * Options for harness instance creation.
 */
export interface CreateOptions {
	/** Optional unified event bus for context propagation (008-unified-event-system) */
	unifiedBus?: IUnifiedEventBus;
}

/**
 * Factory returned by defineHarness().
 * Call create() to get a runnable instance.
 */
export interface HarnessFactory<TState, TInput, TResult> {
	/** Create a new harness instance with the given input */
	create: (input: TInput, options?: CreateOptions) => HarnessInstance<TState, TResult>;
}

/**
 * Running harness instance.
 * Supports chainable event subscription and execution.
 */
export interface HarnessInstance<TState, TResult> {
	/** Attach a consumer to the transport (e.g., renderer, logger). Returns this for chaining. */
	attach: (attachment: Attachment) => this;

	/** Chainable event subscription. Returns this for chaining. */
	on: <E extends HarnessEventType>(type: E, handler: FluentEventHandler<E>) => this;

	/** Execute the harness. Returns result with state and collected events. */
	run: () => Promise<HarnessResult<TState, TResult>>;

	/** Access current state (readonly from external perspective) */
	readonly state: TState;
}

/**
 * Result of harness.run().
 * Contains the execution result, final state, collected events, and timing.
 */
export interface HarnessResult<TState, TResult> {
	/** Return value from run()/execute() */
	result: TResult;

	/** Final state after execution */
	state: TState;

	/** All events emitted during execution */
	events: FluentHarnessEvent[];

	/** Total execution time in milliseconds */
	duration: number;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Define a harness configuration.
 *
 * @param config - Harness configuration
 * @returns HarnessFactory with create() method
 *
 * @example
 * ```typescript
 * import { defineHarness } from '@openharness/sdk';
 * import { CodingAgent } from './agents/coding-agent.js';
 *
 * // Level 2: Simple workflow (no state)
 * const SimpleWorkflow = defineHarness({
 *   agents: { coder: CodingAgent },
 *   run: async ({ agents }) => {
 *     return agents.coder.execute('Write hello world');
 *   },
 * });
 *
 * // Level 3: Full workflow (with state)
 * const FullWorkflow = defineHarness({
 *   agents: { coder: CodingAgent },
 *   state: (input: { goal: string }) => ({ goal: input.goal, steps: [] }),
 *   run: async ({ agents, state, phase }) => {
 *     return await phase('coding', async () => {
 *       return agents.coder.execute(state.goal);
 *     });
 *   },
 * });
 *
 * // Usage
 * const instance = FullWorkflow.create({ goal: 'Build a CLI' });
 * const result = await instance
 *   .on('phase', (e) => console.log(`Phase: ${e.name}`))
 *   .on('narrative', (e) => console.log(`[${e.agent}] ${e.text}`))
 *   .run();
 * ```
 */
export function defineHarness<
	// biome-ignore lint/suspicious/noExplicitAny: Required for flexible agent typing
	TAgents extends Record<string, Agent>,
	TState = Record<string, never>,
	TInput = void,
	TResult = void,
>(config: HarnessConfig<TAgents, TState, TInput, TResult>): HarnessFactory<TState, TInput, TResult> {
	// Extract config with defaults
	const harnessName = config.name ?? "anonymous-harness";
	const mode = config.mode ?? "live";

	// Create container ONCE (captured in closure) - invariant: "Agent resolution happens once"
	const container = createContainer({ mode });

	// Helper function to detect agent definitions (T020)
	// Agent definitions have 'name' and 'prompt' fields (plain objects)
	// Agent classes are constructor functions
	function isAgentDefinition(agent: unknown): agent is { name: string; prompt: unknown } {
		return (
			typeof agent === "object" &&
			agent !== null &&
			"name" in agent &&
			"prompt" in agent &&
			typeof (agent as { name?: unknown }).name === "string"
		);
	}

	// Bind user-provided agents to container (T020-T021)
	// Supports both agent definitions (config objects) and agent classes
	for (const agent of Object.values(config.agents)) {
		if (isAgentDefinition(agent)) {
			// Agent definition - AgentBuilder will handle it later
			// No binding needed here (builder is bound separately)
			continue;
		}
		// Agent class - bind as before
		container.bind(agent as new (...args: unknown[]) => unknown);
	}

	// Lazy agent resolution with caching (avoids synchronous require() in ESM)
	// Agents are resolved on first create() call and cached for subsequent calls
	let resolvedAgentsCache: ResolvedAgents<TAgents> | null = null;
	let resolutionPromise: Promise<ResolvedAgents<TAgents>> | null = null;

	async function resolveAgents(): Promise<ResolvedAgents<TAgents>> {
		// Return cached agents if already resolved
		if (resolvedAgentsCache) {
			return resolvedAgentsCache;
		}

		// Return in-flight resolution if already started
		if (resolutionPromise) {
			return resolutionPromise;
		}

		// Start resolution
		resolutionPromise = (async () => {
			const resolved = {} as ResolvedAgents<TAgents>;

			for (const [name, agent] of Object.entries(config.agents)) {
				try {
					if (isAgentDefinition(agent)) {
						// Agent definition - use AgentBuilder to build executable agent (T022)
						// Get AgentBuilder from the definition's __builder property (014-clean-di-architecture)
						const agentWithBuilder = agent as typeof agent & {
							__builder?: AgentBuilderType;
							__registerProvider?: (container: { bind: (binding: unknown) => void }) => void;
						};
						const AgentBuilder = agentWithBuilder.__builder;
						const registerProvider = agentWithBuilder.__registerProvider;

						if (!AgentBuilder) {
							throw new Error(
								`Agent definition "${agent.name}" is missing __builder property. ` +
									`Ensure the agent was created with defineAnthropicAgent().`,
							);
						}

						// Register provider dependencies (IAgentRunner, etc.) if available
						if (registerProvider && !container.has(AgentBuilder)) {
							registerProvider(container as { bind: (binding: unknown) => void });
						}

						// Ensure AgentBuilder is bound to container
						if (!container.has(AgentBuilder)) {
							container.bind({
								provide: AgentBuilder,
								useClass: AgentBuilder,
							});
						}

						// Resolve builder and build agent from definition
						const builder = container.get(AgentBuilder) as { build: (def: unknown) => unknown };
						// biome-ignore lint/suspicious/noExplicitAny: Dynamic agent resolution requires any
						(resolved as any)[name] = builder.build(agent);
					} else {
						// Agent class - resolve as before
						// biome-ignore lint/suspicious/noExplicitAny: Dynamic agent resolution requires any
						(resolved as any)[name] = container.get(agent);
					}
				} catch (error) {
					// Provide helpful error message per spec edge case
					const message = error instanceof Error ? error.message : String(error);
					const agentType = isAgentDefinition(agent) ? "definition" : "class";
					const agentName = isAgentDefinition(agent) ? agent.name : (agent as { name?: string }).name ?? "unknown";
					throw new Error(
						`HarnessError: Failed to resolve agent "${name}"\n` +
							`  Agent type: ${agentType}\n` +
							`  Agent name: ${agentName}\n` +
							`  Error: ${message}\n` +
							`  Hint: Ensure all @injectable() dependencies are registered in container bindings`,
					);
				}
			}

			// Cache resolved agents
			resolvedAgentsCache = resolved;
			return resolved;
		})();

		return resolutionPromise;
	}

	// Return factory with create() method
	return {
		create(input: TInput, options?: CreateOptions): HarnessInstance<TState, TResult> {
			// Run state factory (once per create() call) - invariant: "State is created once"
			const stateFactory = config.state ?? (() => ({}) as TState);
			const initialState = stateFactory(input);

			// Check for async state factory (spec edge case)
			if (initialState instanceof Promise) {
				throw new Error("HarnessError: State factory must be synchronous. Use run() for async initialization.");
			}

			// Get UnifiedEventBus from container (T015: Fix agent events not reaching channels)
			// The container already has a UnifiedEventBus registered (via createContainer)
			// Agents inject this bus, so the harness needs to use the SAME bus to emit events
			// Otherwise agent events go to one bus, harness events go to another
			const unifiedBus = options?.unifiedBus ?? container.get(IUnifiedEventBusToken);

			// Create and return HarnessInstance
			// Agent resolution happens lazily when run() is called
			// Type assertion needed because HarnessInstance uses unknown for TInput internally
			// The runtime behavior is correct - we preserve the typed run function
			return new HarnessInstanceImpl({
				name: harnessName,
				agents: resolveAgents, // Pass resolver function instead of resolved agents
				state: initialState,
				run: config.run as ((context: ExecuteContext<TAgents, TState>, input: unknown) => Promise<TResult>) | undefined,
				input,
				unifiedBus, // Pass the container's bus so harness and agents share the same event bus
				// T059: Pass pre-registered attachments to instance
				attachments: config.attachments,
			}) as unknown as HarnessInstance<TState, TResult>;
		},
	};
}
