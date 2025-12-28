/**
 * CodingAgent - Specialized agent for coding tasks
 *
 * Executes coding tasks with structured output containing:
 * - stopReason: Whether task finished, was compacted, or failed
 * - summary: What was accomplished
 * - handoff: Context for the next step
 */

import { inject, injectable } from "@needle-di/core";
import type { IAgentCallbacks } from "@openharness/sdk";
import { IAnthropicRunnerToken, IEventBusToken, Monologue } from "@openharness/sdk";
import { type CodingResult, CodingResultSdkSchema } from "../runner/models.js";
import { PromptRegistry } from "../runner/prompts.js";
import { BaseAnthropicAgent } from "./base-anthropic-agent.js";

/**
 * Options for CodingAgent execution.
 */
export interface CodingAgentOptions {
	/** Event callbacks */
	callbacks?: IAgentCallbacks<CodingResult>;
	/** Timeout in milliseconds */
	timeoutMs?: number;
}

@injectable()
export class CodingAgent extends BaseAnthropicAgent {
	constructor(runner = inject(IAnthropicRunnerToken), eventBus = inject(IEventBusToken, { optional: true }) ?? null) {
		super("Coder", runner, eventBus);
	}

	/**
	 * Execute a coding task.
	 *
	 * @param task - The coding task to complete
	 * @param sessionId - Unique session identifier
	 * @param options - Optional execution options including callbacks
	 * @returns Promise with the structured coding result
	 *
	 * @example
	 * ```typescript
	 * const agent = container.get(CodingAgent);
	 * const result = await agent.execute("Implement a factorial function", "session-1", {
	 *   callbacks: {
	 *     onText: (text) => console.log(text),
	 *     onComplete: (result) => console.log("Done:", result.output?.summary),
	 *   },
	 * });
	 * ```
	 */
	@Monologue("Coder", { sessionIdProvider: (args) => args[1] as string })
	async execute(task: string, sessionId: string, options?: CodingAgentOptions): Promise<CodingResult> {
		const prompt = await PromptRegistry.formatCoding({ task });
		return this.run<CodingResult>(prompt, sessionId, {
			// CodingAgent needs full permissions for file creation and git commits
			permissionMode: "bypassPermissions",
			allowDangerouslySkipPermissions: true,
			outputFormat: CodingResultSdkSchema,
			callbacks: options?.callbacks,
			timeoutMs: options?.timeoutMs,
		});
	}
}
