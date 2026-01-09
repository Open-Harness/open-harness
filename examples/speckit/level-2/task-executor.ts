import { agent } from "@open-harness/core";

/**
 * Task Executor Agent - Level 2
 *
 * Demonstrates agent state that persists across invocations.
 * The state is defined in the agent config and returned with each result.
 */

/** State shape for the task executor */
export interface TaskExecutorState {
	tasksProcessed: number;
	[key: string]: unknown;
}

/** Initial state for new sessions */
export const initialState: TaskExecutorState = {
	tasksProcessed: 0,
};

export const taskExecutor = agent({
	prompt: `You are a task planning assistant.
Given a task description, create a brief implementation plan.
Format: numbered list of 3-5 steps.`,
	// Note: State lives on the harness, not the agent
});
