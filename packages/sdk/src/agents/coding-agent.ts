/**
 * CodingAgent - Specialized agent for coding tasks
 */

import { inject, injectable } from "@needle-di/core";
import { IAgentRunnerToken, IEventBusToken } from "../core/tokens.js";
import { BaseAgent, type StreamCallbacks } from "../runner/base-agent.js";
import { type CodingResult, CodingResultSdkSchema } from "../runner/models.js";
import { PromptRegistry } from "../runner/prompts.js";

@injectable()
export class CodingAgent extends BaseAgent {
	constructor(runner = inject(IAgentRunnerToken), eventBus = inject(IEventBusToken, { optional: true }) ?? null) {
		super("Coder", runner, eventBus);
	}

	/**
	 * Execute a coding task.
	 *
	 * Callbacks are optional - if you don't care about events, just await the result.
	 *
	 * @param task - The coding task to complete
	 * @param sessionId - Unique session identifier
	 * @param callbacks - Optional event callbacks
	 * @returns Promise with the structured coding result
	 */
	async execute(task: string, sessionId: string, callbacks?: StreamCallbacks): Promise<CodingResult> {
		const prompt = await PromptRegistry.formatCoding({ task });
		const lastMsg = await this.run(prompt, sessionId, {
			outputFormat: CodingResultSdkSchema,
			callbacks,
		});

		if (lastMsg && lastMsg.type === "result" && lastMsg.subtype === "success") {
			return lastMsg.structured_output as CodingResult;
		}

		throw new Error("CodingAgent: Failed to get structured output from session.");
	}
}
