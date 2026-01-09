import { agent } from "@open-harness/core";

/**
 * Task Executor Agent - Level 1
 *
 * Takes a task description and creates an implementation plan.
 * This is the simplest building block of the SpecKit system.
 *
 * Level 1 focuses on:
 * - Creating an agent with a system prompt
 * - Running the agent with user input
 * - Getting text output and metrics
 *
 * Note: Structured output with Zod schemas is demonstrated in Level 2+
 * where the full schema-to-JSON-Schema pipeline is wired up.
 */
export const taskExecutor = agent({
	prompt: `You are a task planning assistant.
Given a task description, create a clear implementation plan.
Be specific and actionable.

Format your response as a numbered list of steps.
End with a confidence assessment: HIGH, MEDIUM, or LOW.
If the task is unclear or needs more information, say "NEEDS CLARIFICATION" and explain what's missing.`,
});
