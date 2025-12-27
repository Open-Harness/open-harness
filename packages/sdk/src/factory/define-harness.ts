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

import { createContainer } from "../core/container.js";
import type { IUnifiedEventBus } from "../core/unified-events/types.js";
import type {
	FluentEventHandler,
	FluentHarnessEvent,
	HarnessEventType,
	ParallelOptions,
	RetryOptions,
	StepYield,
} from "../harness/event-types.js";
import { HarnessInstance as HarnessInstanceImpl } from "../harness/harness-instance.js";

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
 * Type helper: converts agent constructor record to instance record.
 * Preserves the full instance type including all methods and properties.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required to accept any agent shape
export type ResolvedAgents<T extends Record<string, AgentConstructor<any>>> = {
	[K in keyof T]: InstanceType<T[K]>;
};

/**
 * Context passed to both run() and execute() functions.
 * Provides access to agents, state, and event helpers.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for flexible agent typing
export interface ExecuteContext<TAgents extends Record<string, AgentConstructor<any>>, TState> {
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
	TAgents extends Record<string, AgentConstructor<any>>,
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
	TAgents extends Record<string, AgentConstructor<any>>,
	TState = Record<string, never>,
	TInput = void,
	TResult = void,
>(config: HarnessConfig<TAgents, TState, TInput, TResult>): HarnessFactory<TState, TInput, TResult> {
	// Extract config with defaults
	const harnessName = config.name ?? "anonymous-harness";
	const mode = config.mode ?? "live";

	// Create container ONCE (captured in closure) - invariant: "Agent resolution happens once"
	const container = createContainer({ mode });

	// Bind user-provided agent constructors to container
	for (const AgentClass of Object.values(config.agents)) {
		// Use container.bind() to register agent for resolution
		container.bind(AgentClass as new (...args: unknown[]) => unknown);
	}

	// Resolve all agents ONCE (not per create() call)
	// This ensures agents are singletons per harness definition
	const resolvedAgents = {} as ResolvedAgents<TAgents>;
	for (const [name, AgentClass] of Object.entries(config.agents)) {
		try {
			resolvedAgents[name as keyof TAgents] = container.get(AgentClass) as InstanceType<TAgents[keyof TAgents]>;
		} catch (error) {
			// Provide helpful error message per spec edge case
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(
				`HarnessError: Failed to resolve agent "${name}"\n` +
					`  Agent class: ${AgentClass.name}\n` +
					`  Error: ${message}\n` +
					`  Hint: Ensure all @injectable() dependencies are registered in container bindings`,
			);
		}
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

			// Create and return HarnessInstance
			// Type assertion needed because HarnessInstance uses unknown for TInput internally
			// The runtime behavior is correct - we preserve the typed run function
			return new HarnessInstanceImpl({
				name: harnessName,
				agents: resolvedAgents,
				state: initialState,
				run: config.run as ((context: ExecuteContext<TAgents, TState>, input: unknown) => Promise<TResult>) | undefined,
				input,
				unifiedBus: options?.unifiedBus,
			}) as unknown as HarnessInstance<TState, TResult>;
		},
	};
}
