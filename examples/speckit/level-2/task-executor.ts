import { agent, harness } from "@open-harness/core";

/**
 * Task Executor - Level 2
 *
 * Demonstrates harness-level state that persists across invocations.
 * In v0.3.0, agents are stateless - state lives on the harness.
 *
 * This example shows:
 * - Single agent wrapped in a harness
 * - State defined at harness level
 * - State returned with harness run result
 */

/** State shape for the task executor harness */
export interface TaskExecutorState {
	tasksProcessed: number;
	[key: string]: unknown;
}

/** Initial state for new sessions */
export const initialState: TaskExecutorState = {
	tasksProcessed: 0,
};

/** The underlying agent (stateless) */
export const taskExecutorAgent = agent({
	prompt: `You are a task planning assistant.
Given a task description, create a brief implementation plan.
Format: numbered list of 3-5 steps.`,
});

/**
 * Task Executor Harness
 *
 * Wraps the single agent with harness-level state.
 * Even for single agents, use a harness when you need state tracking.
 */
export const taskExecutor = harness({
	agents: {
		executor: taskExecutorAgent,
	},
	edges: [],
	state: initialState,
});
