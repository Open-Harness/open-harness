// Provider: Claude (Claude Code SDK)
// Implements docs/implementation/roadmap.md Milestone 6

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
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

function ensureClaudeTempDirs(): { configDir: string; debugDir: string } {
	const configDir = resolve(process.cwd(), ".claude-tmp");
	const debugDir = resolve(configDir, "debug");
	mkdirSync(debugDir, { recursive: true });
	if (!process.env.CLAUDE_CONFIG_DIR) {
		process.env.CLAUDE_CONFIG_DIR = configDir;
	}
	if (process.env.CLAUDE_CODE_DEBUG_LOGS_DIR === debugDir) {
		delete process.env.CLAUDE_CODE_DEBUG_LOGS_DIR;
	}
	return { configDir, debugDir };
}

function mergeOptions(options?: Options): Options | undefined {
	const { configDir } = ensureClaudeTempDirs();
	const mergedEnv = {
		CLAUDE_CONFIG_DIR: configDir,
		...(options?.env ?? {}),
	};

	return {
		persistSession: false,
		permissionMode: "bypassPermissions",
		allowDangerouslySkipPermissions: true,
		...options,
		env: mergedEnv,
	};
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
		const errors = "errors" in result ? result.errors : undefined;
		throw new Error(errors?.join("; ") ?? "Claude agent failed");
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
			_ctx: AgentExecuteContext,
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
