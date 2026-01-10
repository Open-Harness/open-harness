import { createHarness, ClaudeProvider } from "@open-harness/core";

/**
 * Task Executor Agent - Level 1
 *
 * Takes a task description and creates an implementation plan.
 * This is the simplest building block of the SpecKit system.
 *
 * Level 1 focuses on:
 * - Creating a reactive agent with activateOn/emits
 * - Running with runReactive
 * - Getting text output and metrics
 *
 * v0.3.0 Migration:
 * - Uses createHarness() for typed agent factory
 * - Uses runReactive() instead of run()
 * - Agent has activateOn/emits for signal-based activation
 */

// =============================================================================
// 1. Define state type (minimal for Level 1)
// =============================================================================

export type TaskExecutorState = {
	/** Input prompt from user */
	prompt: string;
	/** Output plan from agent */
	plan: string | null;
};

// =============================================================================
// 2. Create typed harness factory
// =============================================================================

const { agent, runReactive } = createHarness<TaskExecutorState>();

// =============================================================================
// 3. Define the task executor agent
// =============================================================================

export const taskExecutor = agent({
	prompt: `You are a task planning assistant.
Given a task description, create a clear implementation plan.
Be specific and actionable.

Task: {{ state.prompt }}

Format your response as a numbered list of steps.
End with a confidence assessment: HIGH, MEDIUM, or LOW.
If the task is unclear or needs more information, say "NEEDS CLARIFICATION" and explain what's missing.`,

	// Activate when harness starts
	activateOn: ["harness:start"],

	// Emit completion signal
	emits: ["plan:complete"],

	// Store output in state.plan
	updates: "plan",
});

// =============================================================================
// 4. Export runner function for tests
// =============================================================================

const provider = new ClaudeProvider({
	model: "claude-sonnet-4-20250514",
});

/**
 * Run the task executor with a prompt.
 *
 * @param prompt - The task description to plan
 * @returns Result with output, state, and metrics
 */
export async function runTaskExecutor(prompt: string) {
	const result = await runReactive({
		agents: { taskExecutor },
		state: {
			prompt,
			plan: null,
		},
		provider,
		endWhen: (state) => state.plan !== null,
	});

	// Extract text content from plan
	const planOutput = result.state.plan as { content?: string } | string | null;
	const output = typeof planOutput === "string" ? planOutput : planOutput?.content ?? "";

	return {
		output,
		state: result.state,
		metrics: {
			latencyMs: result.metrics.durationMs,
			activations: result.metrics.activations,
		},
		signals: result.signals,
	};
}
