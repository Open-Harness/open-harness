/**
 * PersistentState
 *
 * Manages persistent state and step history for harness execution.
 * Provides bounded context loading for efficient memory usage.
 */

import type { LoadedContext, PersistentStateConfig, StateDelta, Step } from "./types.js";

/**
 * Manages persistent state and step history for harness execution.
 *
 * @template TState - The state type
 * @template TInput - The input type for steps
 * @template TOutput - The output type for steps
 */
export class PersistentState<TState, TInput = unknown, TOutput = unknown> {
	private state: TState;
	private stepHistory: Step<TInput, TOutput>[] = [];
	private readonly maxContextSteps: number;

	/**
	 * Creates a new PersistentState instance.
	 *
	 * @param config - Configuration with initialState and optional maxContextSteps
	 */
	constructor(config: PersistentStateConfig<TState>) {
		this.state = config.initialState;
		this.maxContextSteps = config.maxContextSteps ?? 10;
	}

	/**
	 * Gets the current state snapshot.
	 *
	 * @returns Current state
	 */
	getState(): TState {
		return this.state;
	}

	/**
	 * Updates state immutably using an updater function.
	 *
	 * @param updater - Function that takes current state and returns new state
	 */
	updateState(updater: (state: TState) => TState): void {
		this.state = updater(this.state);
	}

	/**
	 * Records a step in the history.
	 *
	 * @param stepNumber - Sequential step number
	 * @param input - Input data for this step
	 * @param output - Output data from this step
	 * @param stateDelta - State changes made during this step
	 */
	record(stepNumber: number, input: TInput, output: TOutput, stateDelta: StateDelta): void {
		const step: Step<TInput, TOutput> = {
			stepNumber,
			timestamp: Date.now(),
			input,
			output,
			stateDelta,
		};
		this.stepHistory.push(step);
	}

	/**
	 * Gets the full step history.
	 *
	 * @returns Array of all recorded steps (chronological order)
	 */
	getStepHistory(): Step<TInput, TOutput>[] {
		return [...this.stepHistory];
	}

	/**
	 * Gets the most recent N steps.
	 *
	 * @param count - Number of recent steps to return
	 * @returns Array of most recent steps (chronological order)
	 */
	getRecentSteps(count: number): Step<TInput, TOutput>[] {
		if (count <= 0 || this.stepHistory.length === 0) {
			return [];
		}
		const startIndex = Math.max(0, this.stepHistory.length - count);
		return [...this.stepHistory.slice(startIndex)];
	}

	/**
	 * Loads bounded context for agent execution.
	 *
	 * @returns LoadedContext with current state and bounded recent steps
	 */
	loadContext(): LoadedContext<TState> {
		const recentSteps = this.getRecentSteps(this.maxContextSteps);
		// Convert to Step<unknown, unknown>[] for LoadedContext type
		const contextSteps: Step<unknown, unknown>[] = recentSteps.map((step) => ({
			stepNumber: step.stepNumber,
			timestamp: step.timestamp,
			input: step.input,
			output: step.output,
			stateDelta: step.stateDelta,
		}));

		return {
			state: this.state,
			recentSteps: contextSteps,
			relevantKnowledge: {},
		};
	}
}
