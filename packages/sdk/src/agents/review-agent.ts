/**
 * ReviewAgent - Specialized agent for code review tasks
 */

import { inject, injectable } from "@needle-di/core";
import { z } from "zod";
import { IAgentRunnerToken, IEventBusToken } from "../core/tokens.js";
import { BaseAgent, type StreamCallbacks } from "../runner/base-agent.js";
import { zodToSdkSchema } from "../runner/models.js";
import { PromptRegistry } from "../runner/prompts.js";

export const ReviewResultSchema = z.object({
	decision: z.enum(["approve", "reject"]),
	feedback: z.string(),
});

export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export const ReviewResultSdkSchema = zodToSdkSchema(ReviewResultSchema);

@injectable()
export class ReviewAgent extends BaseAgent {
	constructor(runner = inject(IAgentRunnerToken), eventBus = inject(IEventBusToken, { optional: true }) ?? null) {
		super("Reviewer", runner, eventBus);
	}

	/**
	 * Review a coding task implementation.
	 *
	 * Callbacks are optional - if you don't care about events, just await the result.
	 *
	 * @param task - The original coding task
	 * @param implementationSummary - Summary of what was implemented
	 * @param sessionId - Unique session identifier
	 * @param callbacks - Optional event callbacks
	 * @returns Promise with the structured review result
	 */
	async review(
		task: string,
		implementationSummary: string,
		sessionId: string,
		callbacks?: StreamCallbacks,
	): Promise<ReviewResult> {
		const prompt = await PromptRegistry.formatReview({
			task,
			implementationSummary,
		});

		// Restriction: only Read, Glob, Grep, and Bash (for git)
		const lastMsg = await this.run(prompt, sessionId, {
			allowedTools: ["Read", "Glob", "Grep", "Bash"],
			outputFormat: ReviewResultSdkSchema,
			callbacks,
		});

		if (lastMsg && lastMsg.type === "result" && lastMsg.subtype === "success") {
			return lastMsg.structured_output as ReviewResult;
		}

		throw new Error("ReviewAgent: Failed to get structured output from session.");
	}
}
