/**
 * InternalAnthropicAgent - Core agent implementation for the factory pattern
 *
 * This class is NOT exported from the package. It is used internally by
 * `defineAnthropicAgent()` to provide the actual agent execution logic.
 *
 * Key differences from BaseAnthropicAgent:
 * - Uses ONLY IUnifiedEventBus (no legacy IEventBus)
 * - Not intended for subclassing - factory pattern instead
 * - Simpler event handling (unified bus only)
 *
 * @internal
 * @module provider/internal-agent
 */

import { inject, injectable } from "@needle-di/core";
import type {
	AgentError,
	AgentResult,
	AgentStartMetadata,
	GenericMessage,
	GenericRunnerOptions,
	IAgentCallbacks,
	IAgentRunner,
	IUnifiedEventBus,
	TokenUsage,
} from "@openharness/sdk";
import { IAgentRunnerToken, IUnifiedEventBusToken } from "@openharness/sdk";
import { mapSdkMessageToUnifiedEvents } from "../infra/runner/event-mapper.js";

/**
 * Options for internal agent execution.
 * Uses SDK's GenericRunnerOptions with additional callback support.
 */
export interface InternalRunOptions<TOutput = unknown> extends GenericRunnerOptions {
	/** Callbacks for agent events */
	callbacks?: IAgentCallbacks<TOutput>;
	/** Timeout in milliseconds */
	timeoutMs?: number;
	/** Output format for structured responses */
	outputFormat?: unknown;
}

/**
 * Internal agent implementation used by the factory.
 *
 * This class:
 * - Wraps the IAgentRunner for LLM execution
 * - Emits events to IUnifiedEventBus (unified bus only, no legacy bus)
 * - Fires typed callbacks during execution
 * - Handles timeouts and result processing
 *
 * @internal Not exported from package
 */
@injectable()
export class InternalAnthropicAgent {
	constructor(
		public readonly name: string,
		private readonly runner: IAgentRunner = inject(IAgentRunnerToken),
		private readonly unifiedBus: IUnifiedEventBus | null = inject(IUnifiedEventBusToken, { optional: true }) ?? null,
	) {}

	/**
	 * Run the agent with a prompt.
	 *
	 * @param prompt - The prompt to send to the LLM
	 * @param sessionId - Unique session identifier
	 * @param options - Execution options including callbacks
	 * @returns The structured output (if outputFormat provided) or the raw result
	 */
	async run<TOutput = unknown>(
		prompt: string,
		sessionId: string,
		options?: InternalRunOptions<TOutput>,
	): Promise<TOutput> {
		const { callbacks, timeoutMs, ...runnerOptions } = options ?? {};
		const startTime = Date.now();

		// Fire onStart callback
		this.fireOnStart(sessionId, callbacks);

		try {
			// Create execution promise
			const runPromise = this.executeWithCallbacks(prompt, runnerOptions, callbacks);

			// Apply timeout if specified
			let result: GenericMessage | undefined;
			if (timeoutMs && timeoutMs > 0) {
				result = await Promise.race([runPromise, this.createTimeout(timeoutMs)]);
			} else {
				result = await runPromise;
			}

			// Process and return result
			return this.processResult(result, startTime, callbacks);
		} catch (error) {
			this.fireOnError(error, callbacks);
			throw error;
		}
	}

	/**
	 * Execute the runner with callbacks wired up.
	 */
	private async executeWithCallbacks<TOutput>(
		prompt: string,
		options: GenericRunnerOptions,
		callbacks?: IAgentCallbacks<TOutput>,
	): Promise<GenericMessage | undefined> {
		return this.runner.run({
			prompt,
			options,
			callbacks: {
				onMessage: (msg: GenericMessage) => {
					this.handleMessage(msg, callbacks);
				},
			},
		});
	}

	/**
	 * Handle a message from the runner.
	 *
	 * Unlike BaseAnthropicAgent, this ONLY uses IUnifiedEventBus.
	 * The legacy IEventBus is not supported per research.md Q4 decision.
	 */
	private handleMessage<TOutput>(msg: GenericMessage, callbacks?: IAgentCallbacks<TOutput>): void {
		// Emit to unified bus if available
		if (this.unifiedBus) {
			// SAFETY: IAgentRunner returns GenericMessage for SDK-agnostic interface,
			// but at runtime this is AnthropicRunner which produces SDKMessage.
			// The GenericMessage we receive IS an SDKMessage with all required fields.
			// We use 'unknown' intermediate cast to preserve type safety while acknowledging
			// this runtime guarantee that the type system cannot express.
			const unifiedEvents = mapSdkMessageToUnifiedEvents(msg as unknown as SDKMessage, this.name);
			for (const event of unifiedEvents) {
				try {
					this.unifiedBus.emit(event, { agent: { name: this.name } });
				} catch {
					// Silently ignore bus errors (per existing pattern)
				}
			}
		}

		// Fire callbacks based on message type
		this.fireCallbacksFromMessage(msg, callbacks);
	}

	/**
	 * Fire callbacks directly from generic message.
	 *
	 * This is a simplified version that maps directly from GenericMessage
	 * to callbacks without going through the AgentEvent intermediate.
	 */
	private fireCallbacksFromMessage<TOutput>(msg: GenericMessage, callbacks?: IAgentCallbacks<TOutput>): void {
		if (!callbacks) return;

		try {
			const msgType = msg.type;

			if (msgType === "assistant") {
				const message = (msg as { message?: { content?: unknown[] } }).message;
				if (message?.content && Array.isArray(message.content)) {
					for (const block of message.content) {
						if (typeof block === "object" && block !== null) {
							const b = block as Record<string, unknown>;
							if (b.type === "text" && typeof b.text === "string" && callbacks.onText) {
								callbacks.onText(b.text, false);
							} else if (b.type === "thinking" && typeof b.thinking === "string" && callbacks.onThinking) {
								callbacks.onThinking(b.thinking);
							} else if (b.type === "tool_use" && typeof b.name === "string" && callbacks.onToolCall) {
								callbacks.onToolCall({
									toolName: b.name,
									input: (b.input as Record<string, unknown>) ?? {},
								});
							}
						}
					}
				}
			} else if (msgType === "user") {
				// Tool results from user turn
				const message = (msg as { message?: { content?: unknown[] } }).message;
				if (message?.content && Array.isArray(message.content)) {
					for (const block of message.content) {
						if (typeof block === "object" && block !== null) {
							const b = block as Record<string, unknown>;
							if (b.type === "tool_result" && callbacks.onToolResult) {
								let content = "";
								if (typeof b.content === "string") {
									content = b.content;
								} else if (Array.isArray(b.content)) {
									content = b.content
										.filter(
											(c): c is { type: "text"; text: string } =>
												typeof c === "object" && c !== null && (c as { type?: string }).type === "text",
										)
										.map((c) => c.text)
										.join("\n");
								}
								callbacks.onToolResult({
									content,
									isError: Boolean(b.is_error),
								});
							}
						}
					}
				}
			} else if (msgType === "tool_progress") {
				// Tool progress updates
				const toolMsg = msg as { tool_name?: string; elapsed_seconds?: number };
				if (callbacks.onProgress) {
					callbacks.onProgress({
						toolName: toolMsg.tool_name ?? "unknown",
						elapsedSeconds: toolMsg.elapsed_seconds ?? 0,
					});
				}
			}
		} catch {
			// Silently ignore callback errors (per existing pattern)
		}
	}

	/**
	 * Fire the onStart callback.
	 */
	private fireOnStart<TOutput>(sessionId: string, callbacks?: IAgentCallbacks<TOutput>): void {
		if (callbacks?.onStart) {
			const metadata: AgentStartMetadata = {
				agentName: this.name,
				sessionId,
			};
			callbacks.onStart(metadata);
		}
	}

	/**
	 * Fire the onError callback.
	 */
	private fireOnError<TOutput>(error: unknown, callbacks?: IAgentCallbacks<TOutput>): void {
		if (callbacks?.onError) {
			const agentError: AgentError = {
				message: error instanceof Error ? error.message : String(error),
				cause: error,
			};
			callbacks.onError(agentError);
		}
	}

	/**
	 * Process the final result, firing onComplete callback.
	 */
	private processResult<TOutput>(
		result: GenericMessage | undefined,
		startTime: number,
		callbacks?: IAgentCallbacks<TOutput>,
	): TOutput {
		const durationMs = Date.now() - startTime;

		if (result && result.type === "result") {
			const resultMsg = result as {
				subtype?: string;
				structured_output?: unknown;
				errors?: string[];
				usage?: {
					input_tokens?: number;
					output_tokens?: number;
					cache_read_input_tokens?: number;
					cache_creation_input_tokens?: number;
				};
			};

			const isSuccess = resultMsg.subtype === "success";

			// Build usage stats
			const usage: TokenUsage = {
				inputTokens: resultMsg.usage?.input_tokens ?? 0,
				outputTokens: resultMsg.usage?.output_tokens ?? 0,
				cacheReadInputTokens: resultMsg.usage?.cache_read_input_tokens ?? 0,
				cacheCreationInputTokens: resultMsg.usage?.cache_creation_input_tokens ?? 0,
			};

			// Fire onComplete callback
			if (callbacks?.onComplete) {
				const agentResult: AgentResult<TOutput> = {
					success: isSuccess,
					output: isSuccess ? (resultMsg.structured_output as TOutput) : undefined,
					usage,
					durationMs,
					errors: !isSuccess ? resultMsg.errors : undefined,
				};
				callbacks.onComplete(agentResult);
			}

			if (isSuccess) {
				return resultMsg.structured_output as TOutput;
			}

			throw new Error(`Agent execution failed: ${resultMsg.errors?.join(", ") ?? "Unknown error"}`);
		}

		throw new Error("Agent did not return a result message");
	}

	/**
	 * Create a timeout promise.
	 */
	private createTimeout(ms: number): Promise<never> {
		return new Promise((_, reject) => {
			setTimeout(() => {
				reject(new Error(`Agent execution timed out after ${ms}ms`));
			}, ms);
		});
	}
}
