/**
 * Harness Types
 *
 * TypeScript interfaces for harness concepts providing type safety and clear contracts.
 */

/**
 * Tracks modifications to state during a step execution.
 */
export interface StateDelta {
	/** Array of state property names that were modified */
	modified: string[];
	/** Optional summary of the changes made */
	summary?: string;
}

/**
 * Represents a single step in the harness execution flow.
 *
 * @template TInput - The input type for this step
 * @template TOutput - The output type for this step
 */
export interface Step<TInput, TOutput> {
	/** Sequential step number */
	stepNumber: number;
	/** Timestamp when the step was executed */
	timestamp: number;
	/** Input data for this step */
	input: TInput;
	/** Output data from this step */
	output: TOutput;
	/** State changes made during this step */
	stateDelta: StateDelta;
}

/**
 * Flexible key-value structure for agent constraints.
 */
export interface Constraints {
	[key: string]: unknown;
}

/**
 * Bounded context loaded for agent execution.
 *
 * @template TState - The state type
 */
export interface LoadedContext<TState> {
	/** Current state snapshot */
	state: TState;
	/** Recent steps for context */
	recentSteps: Step<unknown, unknown>[];
	/** Relevant knowledge base entries */
	relevantKnowledge: Record<string, unknown>;
}

/**
 * Configuration for initializing a harness.
 *
 * @template TState - The state type
 */
export interface HarnessConfig<TState> {
	/** Initial state for the harness */
	initialState: TState;
	/** Optional maximum number of context steps to retain */
	maxContextSteps?: number;
}

/**
 * Yield value from execute() method.
 *
 * @template TInput - The input type
 * @template TOutput - The output type
 */
export type StepYield<TInput, TOutput> = {
	/** Input data */
	input: TInput;
	/** Output data */
	output: TOutput;
};

/**
 * Configuration for persistent state management.
 *
 * @template TState - The state type
 */
export interface PersistentStateConfig<TState> {
	/** Initial state */
	initialState: TState;
	/** Optional storage path or identifier */
	storagePath?: string;
}

/**
 * Configuration for an agent within the harness.
 *
 * @template TState - The state type
 * @template TInput - The input type
 * @template TOutput - The output type
 */
export interface AgentConfig<TState, _TInput, _TOutput> {
	/** Agent name or identifier */
	name: string;
	/** Constraints for the agent */
	constraints?: Constraints;
	/** Initial state */
	initialState?: TState;
}

/**
 * Parameters for running an agent.
 *
 * @template TState - The state type
 * @template TInput - The input type
 * @template TOutput - The output type
 */
export interface AgentRunParams<TState, TInput, _TOutput> {
	/** Input data for the run */
	input: TInput;
	/** Current state */
	state: TState;
	/** Optional context */
	context?: LoadedContext<TState>;
}
