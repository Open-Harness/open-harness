/**
 * PlannerAgent - Specialized agent for breaking PRDs into tickets
 *
 * Takes a Product Requirements Document and produces a list of
 * development tickets with IDs, titles, and descriptions.
 * Uses Haiku model for cost-effective planning.
 */

import { inject, injectable } from "@needle-di/core";
import { z } from "zod";
import type { IAgentCallbacks } from "../callbacks/types.js";
import { IAnthropicRunnerToken, IEventBusToken } from "../core/tokens.js";
import type { JSONSchemaFormat } from "../runner/models.js";
import { PromptRegistry } from "../runner/prompts.js";
import { BaseAnthropicAgent } from "./base-anthropic-agent.js";

// ============================================
// Schema
// ============================================

export const TicketSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
});

export type Ticket = z.infer<typeof TicketSchema>;

export const PlannerResultSchema = z.object({
	tickets: z.array(TicketSchema),
});

export type PlannerResult = z.infer<typeof PlannerResultSchema>;

// Manual schema definition for arrays (zodToSdkSchema doesn't handle arrays)
export const PlannerResultSdkSchema: JSONSchemaFormat = {
	type: "json_schema",
	schema: {
		type: "object",
		properties: {
			tickets: {
				type: "array",
				items: {
					type: "object",
					properties: {
						id: { type: "string" },
						title: { type: "string" },
						description: { type: "string" },
					},
					required: ["id", "title", "description"],
				},
			},
		},
		required: ["tickets"],
	},
};

/**
 * Options for PlannerAgent execution.
 */
export interface PlannerAgentOptions {
	/** Event callbacks */
	callbacks?: IAgentCallbacks<PlannerResult>;
	/** Timeout in milliseconds */
	timeoutMs?: number;
}

// ============================================
// Agent
// ============================================

@injectable()
export class PlannerAgent extends BaseAnthropicAgent {
	constructor(runner = inject(IAnthropicRunnerToken), eventBus = inject(IEventBusToken, { optional: true }) ?? null) {
		super("Planner", runner, eventBus);
	}

	/**
	 * Break a PRD into development tickets.
	 *
	 * @param prd - The product requirements document to break down
	 * @param sessionId - Unique session identifier
	 * @param options - Optional execution options including callbacks
	 * @returns Promise with the structured planner result containing tickets
	 *
	 * @example
	 * ```typescript
	 * const agent = container.get(PlannerAgent);
	 * const result = await agent.plan(prdContent, "session-1", {
	 *   callbacks: {
	 *     onComplete: (result) => {
	 *       console.log(`Created ${result.output?.tickets.length} tickets`);
	 *     },
	 *   },
	 * });
	 * ```
	 */
	async plan(prd: string, sessionId: string, options?: PlannerAgentOptions): Promise<PlannerResult> {
		const prompt = await PromptRegistry.formatPlanner({ prd });
		return this.run<PlannerResult>(prompt, sessionId, {
			model: "haiku",
			maxTurns: 3,
			outputFormat: PlannerResultSdkSchema,
			callbacks: options?.callbacks,
			timeoutMs: options?.timeoutMs,
		});
	}
}
