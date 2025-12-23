/**
 * BaseHarness
 *
 * Abstract base class for harness implementations.
 * Provides step tracking infrastructure while allowing users to own execution logic.
 */

import { PersistentState } from "./state.js";
import type { HarnessConfig, LoadedContext, Step, StepYield } from "./types.js";

/**
 * Abstract base class for harness implementations.
 *
 * Users extend this class and implement `execute()` as an AsyncGenerator
 * that yields { input, output } pairs. The framework handles step tracking,
 * history recording, and state management.
 *
 * @template TState - The state type
 * @template TInput - The input type
 * @template TOutput - The output type
 */
export abstract class BaseHarness<TState, TInput, TOutput> {
	/** Current step number (starts at 0, increments after each yield) */
	protected currentStep: number = 0;

	/** Persistent state manager */
	protected state: PersistentState<TState, TInput, TOutput>;

	/**
	 * Creates a new BaseHarness instance.
	 *
	 * @param config - Harness configuration with initialState and optional maxContextSteps
	 */
	constructor(config: HarnessConfig<TState>) {
		this.state = new PersistentState<TState, TInput, TOutput>({
			initialState: config.initialState,
			maxContextSteps: config.maxContextSteps,
		});
	}

	/**
	 * Abstract method that users MUST implement.
	 * Yields { input, output } pairs that represent steps in the harness execution.
	 *
	 * @returns AsyncGenerator yielding StepYield pairs
	 */
	protected abstract execute(): AsyncGenerator<StepYield<TInput, TOutput>>;

	/**
	 * Runs the harness by iterating the execute() generator.
	 * Automatically increments currentStep and records each step to history.
	 * Stops early if isComplete() returns true.
	 *
	 * @returns Promise that resolves when execution completes
	 */
	async run(): Promise<void> {
		for await (const { input, output } of this.execute()) {
			this.currentStep++;
			this.state.record(this.currentStep, input, output, { modified: [] });

			if (this.isComplete()) {
				break;
			}
		}
	}

	/**
	 * Loads the bounded context for agent execution.
	 * Provides current state and recent steps for context.
	 *
	 * @returns LoadedContext with state and recent steps
	 */
	protected loadContext(): LoadedContext<TState> {
		return this.state.loadContext();
	}

	/**
	 * Checks if the harness execution is complete.
	 * Users can override this method to add custom completion logic.
	 * Default implementation returns false (allows generator to complete naturally).
	 *
	 * @returns true if complete, false otherwise
	 */
	isComplete(): boolean {
		return false;
	}

	/**
	 * Gets the current step number.
	 *
	 * @returns Current step number (0-indexed before first yield)
	 */
	getCurrentStep(): number {
		return this.currentStep;
	}

	/**
	 * Gets the full step history.
	 *
	 * @returns Array of all recorded steps
	 */
	getStepHistory(): Step<TInput, TOutput>[] {
		return this.state.getStepHistory();
	}

	/**
	 * Gets the current state snapshot.
	 *
	 * @returns Current state
	 */
	getState(): TState {
		return this.state.getState();
	}
}
