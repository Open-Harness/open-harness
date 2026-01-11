/**
 * ClaudeProvider - Provider implementation for Claude SDK
 *
 * Bridges the @anthropic-ai/claude-agent-sdk to the Open Harness signal-based architecture.
 * Yields Signal objects as events stream in from the SDK.
 */

import type { Options, SDKMessage, SDKResultMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
	createSignal,
	PROVIDER_SIGNALS,
	type Provider,
	type ProviderCapabilities,
	type ProviderInput,
	type ProviderOutput,
	type RunContext,
	type Signal,
	type TokenUsage,
	type ToolCall,
} from "@internal/signals-core";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Claude-specific provider input extensions
 */
export interface ClaudeProviderInput extends ProviderInput {
	/** Model to use (e.g., "claude-sonnet-4-20250514") */
	readonly model?: string;
	/** Max turns before stopping (default: 100) */
	readonly maxTurns?: number;
	/** JSON schema for structured output */
	readonly outputSchema?: Record<string, unknown>;
}

/**
 * Claude-specific provider output extensions
 */
export interface ClaudeProviderOutput extends ProviderOutput {
	/** Structured output if outputSchema was provided */
	readonly structuredOutput?: unknown;
	/** Number of turns in the conversation */
	readonly numTurns?: number;
}

/**
 * Configuration for ClaudeProvider
 */
export interface ClaudeProviderConfig {
	/** Default model to use */
	model?: string;
	/** Default max turns */
	maxTurns?: number;
	/** Custom query function (for testing) */
	queryFn?: typeof query;
}

// ============================================================================
// ClaudeProvider Implementation
// ============================================================================

/**
 * Provider for Claude SDK
 *
 * Implements the Provider interface for @anthropic-ai/claude-agent-sdk.
 * Emits signals as SDK events stream in.
 *
 * @example
 * ```ts
 * const provider = new ClaudeProvider({ model: "claude-sonnet-4-20250514" });
 *
 * for await (const signal of provider.run(input, ctx)) {
 *   console.log(signal.name, signal.payload);
 * }
 * ```
 */
export class ClaudeProvider implements Provider<ClaudeProviderInput, ClaudeProviderOutput> {
	readonly type = "claude";
	readonly displayName = "Claude (Anthropic)";
	readonly capabilities: ProviderCapabilities = {
		streaming: true,
		structuredOutput: true,
		tools: true,
		resume: true,
	};

	private readonly queryFn: typeof query;
	private readonly defaultModel: string;
	private readonly defaultMaxTurns: number;

	constructor(config?: ClaudeProviderConfig) {
		this.queryFn = config?.queryFn ?? query;
		this.defaultModel = config?.model ?? "claude-sonnet-4-20250514";
		this.defaultMaxTurns = config?.maxTurns ?? 100;
	}

	/**
	 * Run the provider
	 *
	 * Yields signals as the SDK streams events, then returns the final output.
	 */
	async *run(input: ClaudeProviderInput, ctx: RunContext): AsyncGenerator<Signal, ClaudeProviderOutput> {
		const startTime = Date.now();
		const source = { provider: this.type };

		// Track state for final output
		let accumulatedText = "";
		let accumulatedThinking = "";
		const toolCalls: ToolCall[] = [];
		let sessionId: string | undefined = input.sessionId;
		let usage: TokenUsage | undefined;
		let structuredOutput: unknown;
		let numTurns: number | undefined;
		let stopReason: ProviderOutput["stopReason"] = "end";

		// Track pending tool uses for correlation
		const pendingToolUses = new Map<string, { name: string; input: unknown }>();

		// Emit provider:start
		yield createSignal(
			PROVIDER_SIGNALS.START,
			{
				input,
			},
			source,
		);

		// Build SDK options
		const abortController = new AbortController();
		ctx.signal.addEventListener("abort", () => abortController.abort());

		const sdkOptions: Options = {
			resume: input.sessionId,
			model: input.model ?? this.defaultModel,
			abortController,
			maxTurns: input.maxTurns ?? this.defaultMaxTurns,
			persistSession: true,
			includePartialMessages: true,
			permissionMode: "bypassPermissions",
			allowDangerouslySkipPermissions: true,
			...(input.outputSchema
				? {
						outputFormat: {
							type: "json_schema",
							schema: input.outputSchema,
						},
					}
				: {}),
		};

		// Convert messages to SDK format
		const prompt = this.toSDKMessages(input);

		try {
			const queryStream = this.queryFn({ prompt, options: sdkOptions });

			for await (const message of queryStream) {
				// Check for abort
				if (ctx.signal.aborted) {
					break;
				}

				const sdkMessage = message as SDKMessage;

				// Extract session ID from any message that has it
				const msgSessionId = this.extractSessionId(sdkMessage);
				if (msgSessionId) {
					sessionId = msgSessionId;
				}

				// Process different message types
				yield* this.processMessage(
					sdkMessage,
					source,
					accumulatedText,
					accumulatedThinking,
					toolCalls,
					pendingToolUses,
					(text) => {
						accumulatedText += text;
					},
					(thinking) => {
						accumulatedThinking += thinking;
					},
					(call) => {
						toolCalls.push(call);
					},
					(u) => {
						usage = u;
					},
					(so) => {
						structuredOutput = so;
					},
					(n) => {
						numTurns = n;
					},
					(r) => {
						stopReason = r;
					},
				);
			}
		} catch (error) {
			// Check if abort was requested
			if (error instanceof Error && error.name === "AbortError" && ctx.signal.aborted) {
				// Emit provider:end for abort
				const durationMs = Date.now() - startTime;
				yield createSignal(
					PROVIDER_SIGNALS.END,
					{
						output: {
							content: accumulatedText,
							toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
							sessionId,
							stopReason: "error",
						},
						durationMs,
					},
					source,
				);

				return {
					content: accumulatedText,
					toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
					sessionId,
					stopReason: "error",
				};
			}

			// Emit error signal
			yield createSignal(
				PROVIDER_SIGNALS.ERROR,
				{
					code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
					message: error instanceof Error ? error.message : String(error),
					recoverable: false,
				},
				source,
			);

			// Emit provider:end for error
			const durationMs = Date.now() - startTime;
			yield createSignal(
				PROVIDER_SIGNALS.END,
				{
					output: {
						content: accumulatedText,
						toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
						sessionId,
						stopReason: "error",
					},
					durationMs,
				},
				source,
			);

			throw error;
		}

		// Emit text:complete if we accumulated text
		if (accumulatedText) {
			yield createSignal(
				PROVIDER_SIGNALS.TEXT_COMPLETE,
				{
					content: accumulatedText,
				},
				source,
			);
		}

		// Emit thinking:complete if we accumulated thinking
		if (accumulatedThinking) {
			yield createSignal(
				PROVIDER_SIGNALS.THINKING_COMPLETE,
				{
					content: accumulatedThinking,
				},
				source,
			);
		}

		// Build final output
		const output: ClaudeProviderOutput = {
			content: accumulatedText,
			toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
			sessionId,
			usage,
			stopReason,
			structuredOutput,
			numTurns,
		};

		// Emit provider:end
		const durationMs = Date.now() - startTime;
		yield createSignal(
			PROVIDER_SIGNALS.END,
			{
				output,
				durationMs,
			},
			source,
		);

		return output;
	}

	/**
	 * Process an SDK message and yield appropriate signals
	 */
	private *processMessage(
		sdkMessage: SDKMessage,
		source: { provider: string },
		_accText: string,
		_accThinking: string,
		_toolCalls: ToolCall[],
		pendingToolUses: Map<string, { name: string; input: unknown }>,
		onText: (text: string) => void,
		onThinking: (thinking: string) => void,
		onToolCall: (call: ToolCall) => void,
		onUsage: (usage: TokenUsage) => void,
		onStructuredOutput: (output: unknown) => void,
		onNumTurns: (n: number) => void,
		onStopReason: (r: ProviderOutput["stopReason"]) => void,
	): Generator<Signal> {
		// Handle stream events (text_delta, thinking_delta)
		if (sdkMessage.type === "stream_event") {
			const streamEvent = sdkMessage.event as {
				type?: string;
				delta?: { type?: string; text?: string; thinking?: string };
			};

			if (streamEvent?.type === "content_block_delta") {
				const delta = streamEvent.delta;

				if (delta?.type === "text_delta" && delta.text) {
					onText(delta.text);
					yield createSignal(
						PROVIDER_SIGNALS.TEXT_DELTA,
						{
							content: delta.text,
						},
						source,
					);
				}

				if (delta?.type === "thinking_delta" && delta.thinking) {
					onThinking(delta.thinking);
					yield createSignal(
						PROVIDER_SIGNALS.THINKING_DELTA,
						{
							content: delta.thinking,
						},
						source,
					);
				}
			}
		}

		// Handle assistant messages
		if (sdkMessage.type === "assistant") {
			const content = sdkMessage.message?.content;

			// Handle array content (blocks)
			if (Array.isArray(content)) {
				for (const block of content as unknown as Array<Record<string, unknown>>) {
					const blockType = block.type;

					// Handle tool_use blocks
					if (blockType === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
						const toolCall: ToolCall = {
							id: block.id,
							name: block.name,
							input: block.input,
						};

						pendingToolUses.set(block.id, { name: block.name, input: block.input });
						onToolCall(toolCall);

						yield createSignal(
							PROVIDER_SIGNALS.TOOL_CALL,
							{
								id: block.id,
								name: block.name,
								input: block.input,
							},
							source,
						);
					}

					// Handle text blocks (non-delta complete text)
					if (blockType === "text") {
						const text = block.text;
						if (typeof text === "string" && text.length > 0) {
							// Text blocks in assistant messages are complete text, not deltas
							// We don't emit text:delta for these as they come after streaming
						}
					}

					// Handle thinking blocks (non-delta complete thinking)
					if (blockType === "thinking") {
						const thinking = block.thinking;
						if (typeof thinking === "string" && thinking.length > 0) {
							// Thinking blocks in assistant messages are complete, not deltas
							// We don't emit thinking:delta for these as they come after streaming
						}
					}
				}
			}
		}

		// Handle tool use results
		if (sdkMessage.type === "user" && sdkMessage.tool_use_result) {
			const toolUseId = sdkMessage.parent_tool_use_id ?? undefined;
			const pending = toolUseId ? pendingToolUses.get(toolUseId) : undefined;
			const toolName = pending?.name ?? "unknown";

			const error =
				typeof sdkMessage.tool_use_result === "object" &&
				sdkMessage.tool_use_result &&
				"error" in sdkMessage.tool_use_result
					? String((sdkMessage.tool_use_result as { error?: unknown }).error ?? "")
					: undefined;

			if (toolUseId) {
				pendingToolUses.delete(toolUseId);
			}

			yield createSignal(
				PROVIDER_SIGNALS.TOOL_RESULT,
				{
					id: toolUseId ?? "unknown",
					name: toolName,
					result: sdkMessage.tool_use_result,
					error,
				},
				source,
			);
		}

		// Handle result messages
		if (sdkMessage.type === "result") {
			const result = sdkMessage as SDKResultMessage;

			if (result.subtype === "success") {
				// Extract usage
				if (result.usage) {
					onUsage({
						inputTokens: result.usage.input_tokens ?? 0,
						outputTokens: result.usage.output_tokens ?? 0,
						totalTokens: (result.usage.input_tokens ?? 0) + (result.usage.output_tokens ?? 0),
					});
				}

				// Extract structured output
				if (result.structured_output !== undefined) {
					onStructuredOutput(result.structured_output);
				}

				// Extract num turns
				if (typeof result.num_turns === "number") {
					onNumTurns(result.num_turns);
				}

				onStopReason("end");
			} else {
				// Handle error result
				onStopReason("error");

				const errors = "errors" in result ? (result.errors as string[]) : [];
				yield createSignal(
					PROVIDER_SIGNALS.ERROR,
					{
						code: result.subtype,
						message: errors.length > 0 ? errors.join("; ") : `Claude agent failed with subtype: ${result.subtype}`,
						recoverable: false,
					},
					source,
				);
			}
		}
	}

	/**
	 * Convert ProviderInput messages to SDK format
	 */
	private async *toSDKMessages(input: ClaudeProviderInput): AsyncGenerator<SDKUserMessage> {
		const sessionId = input.sessionId ?? "";

		// If we have a system prompt, send it as the first message
		if (input.system) {
			yield {
				type: "user",
				message: {
					role: "user",
					content: input.system,
				} as SDKUserMessage["message"],
				parent_tool_use_id: null,
				isSynthetic: true,
				tool_use_result: undefined,
				session_id: sessionId,
			} as SDKUserMessage;
		}

		// Convert conversation messages
		for (const message of input.messages) {
			if (message.role === "user") {
				yield {
					type: "user",
					message: {
						role: "user",
						content: message.content,
					} as SDKUserMessage["message"],
					parent_tool_use_id: null,
					isSynthetic: false,
					tool_use_result: undefined,
					session_id: sessionId,
				} as SDKUserMessage;
			}
			// Note: Assistant messages are handled by the SDK session state
		}

		// Handle tool results if any
		if (input.toolResults) {
			for (const toolResult of input.toolResults) {
				yield {
					type: "user",
					message: undefined,
					parent_tool_use_id: null,
					isSynthetic: false,
					tool_use_result: {
						tool_name: toolResult.toolName,
						result: toolResult.result,
						error: toolResult.error,
					},
					session_id: sessionId,
				} as unknown as SDKUserMessage;
			}
		}
	}

	/**
	 * Extract session ID from SDK message
	 */
	private extractSessionId(message: SDKMessage): string | undefined {
		if (message && typeof message === "object" && "session_id" in message) {
			const sessionId = (message as { session_id?: string }).session_id;
			return sessionId || undefined;
		}
		return undefined;
	}
}
