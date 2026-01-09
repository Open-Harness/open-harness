import type {
	ModelUsage,
	NonNullableUsage,
	Options,
	SDKMessage,
	SDKResultMessage,
	SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
	AgentQueryOptions,
	AgentSDKAdapter,
	SessionState,
	UnifiedAgentMessage,
	UnifiedMessage,
	UsageMetrics,
} from "./agent-sdk-adapter.js";

/**
 * Claude SDK adapter implementation.
 *
 * Maps Claude SDK messages to the unified adapter interface.
 */
export class ClaudeSDKAdapter implements AgentSDKAdapter {
	constructor(private queryFn: typeof query = query) {}

	async *query(options: AgentQueryOptions): AsyncGenerator<UnifiedAgentMessage> {
		const prompt = this.toClaudeMessages(options.messages, options.sessionId);
		const sdkOptions: Options = {
			resume: options.sessionId,
			model: options.model,
			abortController: options.abortController,
			maxTurns: 100,
			persistSession: true,
			includePartialMessages: true,
			permissionMode: "bypassPermissions",
			allowDangerouslySkipPermissions: true,
			...(options.outputSchema
				? {
						outputFormat: {
							type: "json_schema",
							schema: options.outputSchema,
						},
					}
				: {}),
		};

		const queryStream = this.queryFn({ prompt, options: sdkOptions });
		const pendingToolUses = new Map<string, { toolName: string; toolInput: unknown; startedAt: number }>();

		let lastSessionId = options.sessionId;
		let emittedStart = false;

		try {
			for await (const message of queryStream) {
				const sdkMessage = message as SDKMessage;
				const sessionId = this.extractSessionId(sdkMessage);
				if (sessionId) {
					lastSessionId = sessionId;
					if (!emittedStart) {
						emittedStart = true;
						yield {
							type: "start",
							sessionId,
							model: options.model,
						};
					}
				}

				// Map Claude SDK messages to unified messages
				yield* this.mapClaudeMessage(sdkMessage, sessionId ?? lastSessionId, pendingToolUses);
			}
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError" && options.abortController?.signal.aborted) {
				// Abort was requested - don't emit error
				return;
			}

			yield {
				type: "error",
				sessionId: lastSessionId,
				error: error instanceof Error ? error : new Error(String(error)),
				errorType: "exception",
				message: error instanceof Error ? error.message : String(error),
				details: error,
			};
			throw error;
		}
	}

	async abort(_sessionId: string): Promise<void> {
		// Claude SDK handles abort via AbortController in query()
		// This is a no-op - abort is handled in query() via abortController
	}

	async getSession(_sessionId: string): Promise<SessionState | undefined> {
		// Claude SDK doesn't expose session state directly
		return undefined;
	}

	private *mapClaudeMessage(
		sdkMessage: SDKMessage,
		sessionId: string | undefined,
		pendingToolUses: Map<string, { toolName: string; toolInput: unknown; startedAt: number }>,
	): Generator<UnifiedAgentMessage> {
		// Handle stream events (text_delta, thinking_delta)
		if (sdkMessage.type === "stream_event") {
			const streamEvent = sdkMessage.event as {
				type?: string;
				delta?: { type?: string; text?: string; thinking?: string };
			};
			if (streamEvent?.type === "content_block_delta") {
				const delta = streamEvent.delta;
				if (delta?.type === "text_delta" && delta.text) {
					yield {
						type: "text_delta",
						sessionId,
						content: delta.text,
					};
				}
				if (delta?.type === "thinking_delta" && delta.thinking) {
					yield {
						type: "thinking_delta",
						sessionId,
						content: delta.thinking,
					};
				}
			}
		}

		// Handle assistant messages
		if (sdkMessage.type === "assistant") {
			if (sdkMessage.error) {
				yield {
					type: "error",
					sessionId,
					error: new Error(sdkMessage.error),
					errorType: sdkMessage.error,
					message: sdkMessage.error,
				};
			}

			const content = sdkMessage.message?.content;

			// Handle string content
			if (typeof content === "string") {
				yield {
					type: "text",
					sessionId,
					content,
				};
			}

			// Handle array content (blocks)
			if (Array.isArray(content)) {
				for (const block of content as unknown as Array<Record<string, unknown>>) {
					const blockType = block.type;

					// Handle tool_use blocks
					if (blockType === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
						pendingToolUses.set(block.id, {
							toolName: block.name,
							toolInput: block.input,
							startedAt: Date.now(),
						});
						yield {
							type: "tool_call",
							sessionId,
							toolId: block.id,
							toolName: block.name,
							toolInput: block.input,
						};
					}

					// Handle text blocks
					if (blockType === "text") {
						const text = block.text;
						if (typeof text === "string" && text.length > 0) {
							yield {
								type: "text",
								sessionId,
								content: text,
							};
						}
					}

					// Handle thinking blocks
					if (blockType === "thinking") {
						const thinking = block.thinking;
						if (typeof thinking === "string" && thinking.length > 0) {
							yield {
								type: "thinking",
								sessionId,
								content: thinking,
							};
						}
					}
				}
			}
		}

		// Handle tool use results
		if (sdkMessage.type === "user" && sdkMessage.tool_use_result) {
			const toolUseId = sdkMessage.parent_tool_use_id ?? undefined;
			const pending = toolUseId ? pendingToolUses.get(toolUseId) : undefined;
			const toolName =
				pending?.toolName ??
				(typeof sdkMessage.tool_use_result === "object" &&
				sdkMessage.tool_use_result &&
				"tool_name" in sdkMessage.tool_use_result
					? String((sdkMessage.tool_use_result as { tool_name?: unknown }).tool_name ?? "unknown")
					: "unknown");

			const error =
				typeof sdkMessage.tool_use_result === "object" &&
				sdkMessage.tool_use_result &&
				"error" in sdkMessage.tool_use_result
					? String((sdkMessage.tool_use_result as { error?: unknown }).error ?? "")
					: undefined;

			if (toolUseId) {
				pendingToolUses.delete(toolUseId);
			}

			yield {
				type: "tool_result",
				sessionId,
				toolId: toolUseId ?? "unknown",
				toolName,
				toolOutput: sdkMessage.tool_use_result,
				error,
			};
		}

		// Handle result messages
		if (sdkMessage.type === "result") {
			const result = sdkMessage as SDKResultMessage;
			if (result.subtype !== "success") {
				const errors = "errors" in result ? (result.errors as string[]) : [];
				yield {
					type: "error",
					sessionId,
					error: new Error(
						errors && errors.length > 0 ? errors.join("; ") : `Claude agent failed with subtype: ${result.subtype}`,
					),
					errorType: result.subtype,
					message:
						errors && errors.length > 0 ? errors.join("; ") : `Claude agent failed with subtype: ${result.subtype}`,
					details: result,
				};
			} else {
				yield {
					type: "complete",
					sessionId: result.session_id,
					content: result.result,
					structuredOutput: result.structured_output,
					usage: this.toUsageMetrics(result.usage, result.modelUsage),
					durationMs: result.duration_ms,
					numTurns: result.num_turns,
				};
			}
		}
	}

	private async *toClaudeMessages(messages: UnifiedMessage[], sessionId?: string): AsyncGenerator<SDKUserMessage> {
		const resolvedSessionId = sessionId ?? "";
		for (const message of messages) {
			yield {
				type: "user",
				message: {
					role: message.role,
					content: message.content,
				} as SDKUserMessage["message"],
				parent_tool_use_id: message.toolUseId ?? null,
				isSynthetic: message.isSynthetic,
				tool_use_result: message.toolUseResult,
				session_id: resolvedSessionId,
			} as SDKUserMessage;
		}
	}

	private extractSessionId(message: SDKMessage): string | undefined {
		if (message && typeof message === "object" && "session_id" in message) {
			const sessionId = (message as { session_id?: string }).session_id;
			return sessionId || undefined;
		}
		return undefined;
	}

	private toUsageMetrics(usage?: NonNullableUsage, modelUsage?: Record<string, ModelUsage>): UsageMetrics {
		const metrics: UsageMetrics = {
			inputTokens: usage?.input_tokens ?? 0,
			outputTokens: usage?.output_tokens ?? 0,
			cacheCreationInputTokens: usage?.cache_creation_input_tokens,
			cacheReadInputTokens: usage?.cache_read_input_tokens,
		};

		if (modelUsage) {
			const mapped: Record<string, { inputTokens: number; outputTokens: number }> = {};
			for (const [model, usage] of Object.entries(modelUsage)) {
				mapped[model] = {
					inputTokens: usage.inputTokens ?? 0,
					outputTokens: usage.outputTokens ?? 0,
				};
			}
			metrics.modelUsage = mapped;
		}

		return metrics;
	}
}
