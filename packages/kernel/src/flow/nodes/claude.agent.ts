// Flow Node: Claude Agent
// Wraps AgentDefinition (from providers) into NodeTypeDefinition (for flows)

import { z } from "zod";
import { AgentInboxImpl } from "../../engine/inbox.js";
import type { NodeTypeDefinition } from "../../protocol/flow.js";
import {
	type ClaudeAgentAdapterOptions,
	type ClaudeAgentInput,
	type ClaudeAgentOutput,
	createClaudeAgent,
} from "../../providers/claude.js";

const ClaudeMessageSchema = z
	.union([
		z.string(),
		z
			.object({
				message: z.record(z.string(), z.unknown()).optional(),
				content: z.string().optional(),
				parentToolUseId: z.string().nullable().optional(),
				isSynthetic: z.boolean().optional(),
				toolUseResult: z.unknown().optional(),
			})
			.refine((value) => value.message || value.content, {
				message: "Claude message input must include message or content",
			}),
	])
	.describe("Claude user message input");

const ClaudeAgentInputSchema = z
	.object({
		prompt: z.string().optional(),
		messages: z.array(ClaudeMessageSchema).optional(),
		options: z.unknown().optional(),
	})
	.refine(
		(value) =>
			(value.prompt && !value.messages) || (!value.prompt && value.messages),
		{
			message: "Provide exactly one of prompt or messages",
		},
	);

const ClaudeAgentOutputSchema = z.object({
	text: z.string(),
	structuredOutput: z.unknown().optional(),
	usage: z.unknown().optional(),
	modelUsage: z.unknown().optional(),
	totalCostUsd: z.number().optional(),
	durationMs: z.number().optional(),
	sessionId: z.string().optional(),
	numTurns: z.number().optional(),
	permissionDenials: z.unknown().optional(),
});

/**
 * Creates a Claude Agent node type definition.
 */
export function createClaudeNode(
	options: ClaudeAgentAdapterOptions = {},
): NodeTypeDefinition<ClaudeAgentInput, ClaudeAgentOutput> {
	return {
		type: "claude.agent",
		inputSchema: ClaudeAgentInputSchema,
		outputSchema: ClaudeAgentOutputSchema,
		capabilities: {
			isStreaming: false,
			supportsInbox: false,
		},
		run: async (ctx, input) => {
			const agent = createClaudeAgent(options);
			const result = await agent.execute(input, {
				hub: ctx.hub,
				inbox: ctx.inbox ?? new AgentInboxImpl(),
				runId: ctx.runId,
			});
			return result;
		},
	};
}

/**
 * Pre-created node instance (most common use case)
 */
export const claudeNode = createClaudeNode();
