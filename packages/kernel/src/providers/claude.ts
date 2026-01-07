// Provider: Claude (Claude Code SDK)
// Implements docs/implementation/roadmap.md Milestone 6

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
import type {
	AgentDefinition,
	AgentExecuteContext,
} from "../protocol/agent.js";

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

export interface ClaudeAgentAdapterOptions {
	replay?: (input: ClaudeAgentInput) => ClaudeAgentOutput | undefined;
}

function createSessionId(): string {
	return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mergeOptions(options?: Options): Options | undefined {
	// Sensible defaults - agents can run as long as needed
	// User options override via passthrough (spread at end)
	const defaults: Partial<Options> = {
		maxTurns: 100, // High default - agents can run as long as needed
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

/**
 * Extract relevant details from SDK message for logging/events
 */
function getMessageDetails(message: SDKMessage): Record<string, unknown> {
	const details: Record<string, unknown> = {};
	const msgType = message.type;

	if (msgType === "assistant") {
		// Assistant response - extract text content preview
		if ("message" in message && message.message) {
			const msg = message.message as { content?: unknown };
			if (typeof msg.content === "string") {
				details.contentPreview = msg.content.slice(0, 100);
				details.contentLength = msg.content.length;
			} else if (Array.isArray(msg.content)) {
				details.contentBlocks = msg.content.length;
			}
		}
	} else if (msgType === "result") {
		// Final result
		const resultMsg = message as SDKResultMessage;
		details.subtype = resultMsg.subtype;
		details.numTurns = resultMsg.num_turns;
		if (resultMsg.subtype === "success") {
			details.resultPreview = resultMsg.result?.slice(0, 100);
		}
	} else if (msgType === "tool_progress") {
		// Tool progress update
		if ("tool_name" in message) {
			details.tool = (message as { tool_name?: string }).tool_name;
		}
	} else {
		// Other message types (stream_event, auth_status, etc.)
		details.raw = msgType;
	}

	return details;
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

export function createClaudeAgent(
	options: ClaudeAgentAdapterOptions = {},
): AgentDefinition<ClaudeAgentInput, ClaudeAgentOutput> {
	return {
		name: "claude.agent",
		async execute(
			input: ClaudeAgentInput,
			ctx: AgentExecuteContext,
		): Promise<ClaudeAgentOutput> {
			if (options.replay) {
				const replay = options.replay(input);
				if (replay) {
					return replay;
				}
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

			const queryStream = query({
				prompt,
				options: mergedOptions,
			});

			let finalResult: SDKResultMessage | undefined;
			let messageCount = 0;

			for await (const message of queryStream) {
				// T021: Check abort signal during agent execution for pause/resume support
				if (ctx.hub.getAbortSignal().aborted) {
					break;
				}

				const sdkMessage = message as SDKMessage;
				messageCount++;

				// Emit streaming event for observability
				ctx.hub.emit({
					type: "claude:message",
					messageType: sdkMessage.type,
					messageCount,
					// Include relevant details based on message type
					details: getMessageDetails(sdkMessage),
				});

				if (sdkMessage.type === "result") {
					finalResult = sdkMessage as SDKResultMessage;
				}
			}

			// Emit completion event
			ctx.hub.emit({
				type: "claude:complete",
				messageCount,
				success: finalResult?.subtype === "success",
				durationMs: finalResult?.duration_ms,
				numTurns: finalResult?.num_turns,
			});

			return getResultOrThrow(finalResult);
		},
	};
}
