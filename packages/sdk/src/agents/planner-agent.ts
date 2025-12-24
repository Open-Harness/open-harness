/**
 * PlannerAgent - Specialized agent for breaking PRDs into tickets
 */

import { inject, injectable } from "@needle-di/core";
import { z } from "zod";
import { IAgentRunnerToken, IEventBusToken } from "../core/tokens.js";
import { BaseAgent, type StreamCallbacks } from "../runner/base-agent.js";
import type { JSONSchemaFormat } from "../runner/models.js";
import { PromptRegistry } from "../runner/prompts.js";

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

// ============================================
// Agent
// ============================================

@injectable()
export class PlannerAgent extends BaseAgent {
	constructor(
		runner = inject(IAgentRunnerToken),
		eventBus = inject(IEventBusToken, { optional: true }) ?? null,
	) {
		super("Planner", runner, eventBus);
	}

	/**
	 * Break a PRD into development tickets.
	 *
	 * @param prd - The product requirements document to break down
	 * @param sessionId - Unique session identifier
	 * @param callbacks - Optional event callbacks
	 * @returns Promise with the structured planner result containing tickets
	 */
	async plan(prd: string, sessionId: string, callbacks?: StreamCallbacks): Promise<PlannerResult> {
		const prompt = await PromptRegistry.formatPlanner({ prd });
		const lastMsg = await this.run(prompt, sessionId, {
			model: "haiku",
			maxTurns: 3, // Need turns for: text response + StructuredOutput tool
			outputFormat: PlannerResultSdkSchema,
			callbacks,
		});

		if (lastMsg && lastMsg.type === "result" && lastMsg.subtype === "success") {
			return lastMsg.structured_output as PlannerResult;
		}

		throw new Error("PlannerAgent: Failed to get structured output from session.");
	}
}
