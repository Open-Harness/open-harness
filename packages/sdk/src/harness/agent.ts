/**
 * Agent
 *
 * Wrapper class for agent logic that provides step-aware execution.
 * Agents receive step context (stepNumber, stepHistory, constraints) when running.
 */

import type { AgentConfig, AgentRunParams } from "./types.js";

/**
 * Agent class that wraps agent logic with step-aware execution.
 *
 * @template TState - The state type
 * @template TInput - The input type
 * @template TOutput - The output type
 */
export class Agent<TState, TInput, TOutput> {
	/** Agent name (defaults to 'Agent' if not provided) */
	readonly name: string;

	private readonly runFn: (
		params: AgentRunParams<TState, TInput, TOutput>,
	) => Promise<TOutput>;
	private readonly isCompleteFn?: (state: TState) => boolean;

	/**
	 * Creates a new Agent instance.
	 *
	 * @param config - Agent configuration with run function and optional name/isComplete
	 */
	constructor(config: AgentConfig<TState, TInput, TOutput>) {
		this.name = config.name ?? "Agent";
		this.runFn = config.run;
		this.isCompleteFn = config.isComplete;
	}

	/**
	 * Runs the agent with the provided parameters.
	 *
	 * Delegates to the user-provided run function, passing all step context
	 * including stepNumber, stepHistory, and constraints. This allows agents
	 * to make decisions based on execution history.
	 *
	 * @example
	 * ```typescript
	 * const result = await agent.run({
	 *   input: data,
	 *   context: currentState,
	 *   stepNumber: 5,
	 *   stepHistory: previousSteps,
	 *   constraints: { maxTokens: 1000 }
	 * });
	 * ```
	 *
	 * @param params - Run parameters including input, context, stepNumber, stepHistory, constraints
	 * @returns Promise resolving to the output
	 */
	async run(params: AgentRunParams<TState, TInput, TOutput>): Promise<TOutput> {
		return this.runFn(params);
	}

	/**
	 * Checks if the agent/harness is complete based on the current state.
	 *
	 * @param state - Current state
	 * @returns true if complete, false otherwise
	 */
	isComplete(state: TState): boolean {
		if (this.isCompleteFn) {
			return this.isCompleteFn(state);
		}
		return false;
	}
}

