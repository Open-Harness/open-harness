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
	 * This is the core of the harness pattern - users control the execution logic
	 * by implementing this generator. The framework handles step tracking automatically.
	 *
	 * @example
	 * ```typescript
	 * async *execute() {
	 *   for (const item of this.items) {
	 *     const output = await this.process(item);
	 *     yield { input: item, output };
	 *   }
	 * }
	 * ```
	 *
	 * @yields { input, output } pairs that will be recorded as steps
	 * @returns AsyncGenerator yielding StepYield pairs
	 */
	protected abstract execute(): AsyncGenerator<StepYield<TInput, TOutput>>;

	/**
	 * Runs the harness by iterating the execute() generator.
	 *
	 * This method owns the execution loop. For each yield from execute():
	 * 1. Increments currentStep (happens AFTER yield is processed)
	 * 2. Records the step to history with timestamp
	 * 3. Checks isComplete() and breaks if true
	 *
	 * The isComplete() check happens AFTER recording, ensuring at least one step
	 * is always processed even if isComplete() would return true initially.
	 *
	 * @example
	 * ```typescript
	 * const harness = new MyHarness({ initialState: { count: 0 } });
	 * await harness.run();
	 * console.log(`Completed ${harness.getCurrentStep()} steps`);
	 * ```
	 *
	 * @returns Promise that resolves when execution completes (generator exhausted or isComplete() returns true)
	 */
	async run(): Promise<void> {
		for await (const { input, output } of this.execute()) {
			// Increment step number AFTER yield is processed
			this.currentStep++;
			// Record step to history (stateDelta tracking can be enhanced by subclasses)
			this.state.record(this.currentStep, input, output, { modified: [] });

			// Check completion AFTER recording - ensures at least one step is processed
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
	 *
	 * Users can override this method to add custom completion logic based on state.
	 * Default implementation returns false, allowing the generator to complete naturally.
	 *
	 * This method is called AFTER each step is recorded, ensuring at least one step
	 * is always processed even if completion conditions are met initially.
	 *
	 * @example
	 * ```typescript
	 * override isComplete(): boolean {
	 *   return this.state.getState().ticketsRemaining <= 0;
	 * }
	 * ```
	 *
	 * @returns true if complete (execution should stop), false otherwise (continue)
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
