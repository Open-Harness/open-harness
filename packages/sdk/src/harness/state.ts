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
	 * The updater function receives the current state and must return a new state object.
	 * This ensures immutability - the original state is never mutated.
	 *
	 * @example
	 * ```typescript
	 * state.updateState(s => ({ ...s, count: s.count + 1 }));
	 * ```
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
	 * Returns steps in chronological order (oldest to newest).
	 * If count is 0 or negative, returns empty array.
	 * If count exceeds history length, returns all available steps.
	 *
	 * @example
	 * ```typescript
	 * // Get last 5 steps
	 * const recent = state.getRecentSteps(5);
	 * ```
	 *
	 * @param count - Number of recent steps to return (must be >= 0)
	 * @returns Array of most recent steps (chronological order), empty if count <= 0
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
	 * Returns a snapshot of the current state and recent steps (bounded by maxContextSteps).
	 * This prevents unbounded memory growth by limiting the number of steps included in context.
	 * Steps are converted to Step<unknown, unknown>[] to match LoadedContext type requirements.
	 *
	 * @example
	 * ```typescript
	 * const context = state.loadContext();
	 * // Use context.state and context.recentSteps in agent execution
	 * ```
	 *
	 * @returns LoadedContext with current state and bounded recent steps (maxContextSteps)
	 */
	loadContext(): LoadedContext<TState> {
		const recentSteps = this.getRecentSteps(this.maxContextSteps);
		// Convert to Step<unknown, unknown>[] for LoadedContext type compatibility
		// This allows LoadedContext to work with any step types
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
			relevantKnowledge: {}, // Placeholder for future knowledge base integration
		};
	}
}
