/**
 * ReviewAgent - Specialized agent for code review tasks
 *
 * Reviews coding task implementations and provides structured feedback.
 * Restricted to read-only tools (Read, Glob, Grep, Bash for git).
 */

import { inject, injectable } from "@needle-di/core";
import { z } from "zod";
import type { IAgentCallbacks } from "../../../callbacks/types.js";
import { IAnthropicRunnerToken, IEventBusToken } from "../../../core/tokens.js";
import { Monologue } from "../../../monologue/monologue-decorator.js";
import { zodToSdkSchema } from "../runner/models.js";
import { PromptRegistry } from "../runner/prompts.js";
import { BaseAnthropicAgent } from "./base-anthropic-agent.js";

export const ReviewResultSchema = z.object({
	decision: z.enum(["approve", "reject"]),
	feedback: z.string(),
});

export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export const ReviewResultSdkSchema = zodToSdkSchema(ReviewResultSchema);

/**
 * Options for ReviewAgent execution.
 */
export interface ReviewAgentOptions {
	/** Event callbacks */
	callbacks?: IAgentCallbacks<ReviewResult>;
	/** Timeout in milliseconds */
	timeoutMs?: number;
}

@injectable()
export class ReviewAgent extends BaseAnthropicAgent {
	constructor(runner = inject(IAnthropicRunnerToken), eventBus = inject(IEventBusToken, { optional: true }) ?? null) {
		super("Reviewer", runner, eventBus);
	}

	/**
	 * Review a coding task implementation.
	 *
	 * @param task - The original coding task
	 * @param implementationSummary - Summary of what was implemented
	 * @param sessionId - Unique session identifier
	 * @param options - Optional execution options including callbacks
	 * @returns Promise with the structured review result
	 *
	 * @example
	 * ```typescript
	 * const agent = container.get(ReviewAgent);
	 * const result = await agent.review(
	 *   "Implement factorial",
	 *   "Added factorial function with recursion",
	 *   "session-1",
	 *   {
	 *     callbacks: {
	 *       onComplete: (result) => console.log(result.output?.decision),
	 *     },
	 *   }
	 * );
	 * ```
	 */
	@Monologue("Reviewer", { sessionIdProvider: (args) => args[2] as string })
	async review(
		task: string,
		implementationSummary: string,
		sessionId: string,
		options?: ReviewAgentOptions,
	): Promise<ReviewResult> {
		const prompt = await PromptRegistry.formatReview({
			task,
			implementationSummary,
		});

		return this.run<ReviewResult>(prompt, sessionId, {
			allowedTools: ["Read", "Glob", "Grep", "Bash"],
			outputFormat: ReviewResultSdkSchema,
			callbacks: options?.callbacks,
			timeoutMs: options?.timeoutMs,
		});
	}
}
