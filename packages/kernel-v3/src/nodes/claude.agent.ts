import type {
	ModelUsage,
	NonNullableUsage,
	Options,
	SDKMessage,
	SDKPermissionDenial,
	SDKResultMessage,
	SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry/registry.js";

export type ClaudeMessageInput =
	| string
	| {
			message?: Record<string, unknown>;
			content?: string;
			parentToolUseId?: string | null;
			isSynthetic?: boolean;
			toolUseResult?: unknown;
	  };

export interface ClaudeAgentInput {
	prompt?: string;
	messages?: ClaudeMessageInput[];
	options?: Options;
}

export interface ClaudeAgentOutput {
	text: string;
	structuredOutput?: unknown;
	usage?: NonNullableUsage;
	modelUsage?: Record<string, ModelUsage>;
	totalCostUsd?: number;
	durationMs?: number;
	sessionId?: string;
	numTurns?: number;
	permissionDenials?: SDKPermissionDenial[];
}

export interface ClaudeNodeOptions {
	replay?: (input: ClaudeAgentInput) => ClaudeAgentOutput | undefined;
	queryFn?: typeof query;
}

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
 * Create a Claude agent node definition.
 */
export function createClaudeNode(
	options: ClaudeNodeOptions = {},
): NodeTypeDefinition<ClaudeAgentInput, ClaudeAgentOutput> {
	return {
		type: "claude.agent",
		inputSchema: ClaudeAgentInputSchema,
		outputSchema: ClaudeAgentOutputSchema,
		capabilities: {
			streaming: false,
			multiTurn: true,
		},
		run: async (_ctx, input) => {
			if (options.replay) {
				const replay = options.replay(input);
				if (replay) return replay;
			}

			const hasPrompt = typeof input.prompt === "string";
			const hasMessages = Array.isArray(input.messages);
			if (hasPrompt === hasMessages) {
				throw new Error(
					"ClaudeAgentInput requires exactly one of prompt or messages",
				);
			}

			let prompt: string | AsyncIterable<SDKUserMessage>;
			if (typeof input.prompt === "string") {
				prompt = input.prompt;
			} else if (Array.isArray(input.messages)) {
				prompt = messageStream(input.messages, createSessionId());
			} else {
				throw new Error(
					"ClaudeAgentInput requires exactly one of prompt or messages",
				);
			}

			const mergedOptions = mergeOptions(input.options);
			const queryFn = options.queryFn ?? query;
			const queryStream = queryFn({
				prompt,
				options: mergedOptions,
			});

			let finalResult: SDKResultMessage | undefined;

			for await (const message of queryStream) {
				const sdkMessage = message as SDKMessage;
				if (sdkMessage.type === "result") {
					finalResult = sdkMessage as SDKResultMessage;
				}
			}

			return getResultOrThrow(finalResult);
		},
	};
}

/**
 * Pre-created Claude node instance.
 */
export const claudeNode = createClaudeNode();

function createSessionId(): string {
	return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mergeOptions(options?: Options): Options | undefined {
	const defaults: Partial<Options> = {
		maxTurns: 100,
		persistSession: false,
		permissionMode: "bypassPermissions",
		allowDangerouslySkipPermissions: true,
	};
	return options ? { ...defaults, ...options } : defaults;
}

function toUserMessage(
	input: ClaudeMessageInput,
	sessionId: string,
): SDKUserMessage {
	if (typeof input === "string") {
		return {
			type: "user",
			message: { role: "user", content: input } as SDKUserMessage["message"],
			parent_tool_use_id: null,
			session_id: sessionId,
		} as SDKUserMessage;
	}

	const message =
		input.message ??
		(input.content
			? ({ role: "user", content: input.content } as SDKUserMessage["message"])
			: undefined);

	if (!message) {
		throw new Error("Claude message input must include message or content");
	}

	return {
		type: "user",
		message,
		parent_tool_use_id: input.parentToolUseId ?? null,
		isSynthetic: input.isSynthetic,
		tool_use_result: input.toolUseResult,
		session_id: sessionId,
	} as SDKUserMessage;
}

async function* messageStream(
	messages: ClaudeMessageInput[],
	sessionId: string,
): AsyncGenerator<SDKUserMessage> {
	for (const message of messages) {
		yield toUserMessage(message, sessionId);
	}
}

function getResultOrThrow(result?: SDKResultMessage): ClaudeAgentOutput {
	if (!result) {
		throw new Error("Claude agent returned no result");
	}

	if (result.subtype !== "success") {
		const errors = "errors" in result ? (result.errors as string[]) : [];
		const errorMessage =
			errors && errors.length > 0
				? errors.join("; ")
				: `Claude agent failed with subtype: ${result.subtype}`;
		throw new Error(errorMessage);
	}

	return {
		text: result.result,
		structuredOutput: result.structured_output,
		usage: result.usage,
		modelUsage: result.modelUsage,
		totalCostUsd: result.total_cost_usd,
		durationMs: result.duration_ms,
		sessionId: result.session_id,
		numTurns: result.num_turns,
		permissionDenials: result.permission_denials,
	};
}
