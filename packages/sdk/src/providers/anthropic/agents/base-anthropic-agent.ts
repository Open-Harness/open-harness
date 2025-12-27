/**
 * BaseAnthropicAgent - Foundation for all Anthropic/Claude agents
 *
 * This is the recommended base class for building agents. It provides:
 * - Typed callbacks via IAgentCallbacks
 * - EventBus integration for cross-cutting concerns
 * - Support for typed structured outputs via Zod schemas
 * - Decorator integration points (recording, monologue)
 *
 * @example
 * ```typescript
 * @injectable()
 * class MyCodingAgent extends BaseAnthropicAgent {
 *   constructor(
 *     runner = inject(IAnthropicRunnerToken),
 *     eventBus = inject(IEventBusToken, { optional: true }) ?? null,
 *   ) {
 *     super("MyCoder", runner, eventBus);
 *   }
 *
 *   async execute(task: string, sessionId: string, callbacks?: IAgentCallbacks<MyOutput>): Promise<MyOutput> {
 *     return this.run("Do this task: " + task, sessionId, {
 *       outputFormat: MyOutputSchema,
 *       callbacks,
 *     });
 *   }
 * }
 * ```
 */

import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { inject, injectable } from "@needle-di/core";
import type {
	AgentError,
	AgentResult,
	AgentStartMetadata,
	IAgentCallbacks,
	TokenUsage,
} from "../../../callbacks/types.js";
import {
	type IAgentRunner,
	IAgentRunnerToken,
	type IEventBus,
	IEventBusToken,
	IUnifiedEventBusToken,
} from "../../../core/tokens.js";
import type { IUnifiedEventBus } from "../../../core/unified-events/types.js";
import { mapSdkMessageToEvents, mapSdkMessageToUnifiedEvents } from "../runner/event-mapper.js";
import { type AgentEvent, EventTypeConst } from "../runner/models.js";

/**
 * Options for agent execution.
 */
export interface AgentRunOptions<TOutput = unknown> extends Omit<Options, "outputFormat"> {
	/** Callbacks for agent events */
	callbacks?: IAgentCallbacks<TOutput>;
	/** Output format schema (Zod schema converted to SDK format) */
	outputFormat?: Options["outputFormat"];
	/** Timeout in milliseconds */
	timeoutMs?: number;
}

/**
 * BaseAnthropicAgent - The recommended base class for Anthropic/Claude agents.
 *
 * Features:
 * - Unified IAgentCallbacks interface
 * - EventBus integration for cross-cutting concerns
 * - Typed structured outputs
 * - Decorator hooks for recording/monologue
 *
 * Concrete agents should:
 * 1. Extend this class
 * 2. Implement an `execute()` method that calls `this.run()`
 * 3. Define their output type and Zod schema
 */
@injectable()
export class BaseAnthropicAgent {
	constructor(
		public readonly name: string,
		protected runner: IAgentRunner = inject(IAgentRunnerToken),
		protected eventBus: IEventBus | null = inject(IEventBusToken, { optional: true }) ?? null,
		protected unifiedBus: IUnifiedEventBus | null = inject(IUnifiedEventBusToken, { optional: true }) ?? null,
	) {}

	/**
	 * Run the agent with a prompt.
	 *
	 * @param prompt - The prompt to send to the LLM
	 * @param sessionId - Unique session identifier
	 * @param options - Execution options including callbacks
	 * @returns The structured output (if outputFormat provided) or the raw result
	 */
	protected async run<TOutput = unknown>(
		prompt: string,
		sessionId: string,
		options?: AgentRunOptions<TOutput>,
	): Promise<TOutput> {
		const { callbacks, timeoutMs, ...runnerOptions } = options ?? {};
		const startTime = Date.now();

		// Fire onStart callback
		this.fireOnStart(sessionId, callbacks);

		try {
			// Create timeout promise if specified
			const runPromise = this.executeWithCallbacks(prompt, sessionId, runnerOptions, callbacks);

			let result: SDKMessage | undefined;
			if (timeoutMs && timeoutMs > 0) {
				result = await Promise.race([runPromise, this.createTimeout(timeoutMs)]);
			} else {
				result = await runPromise;
			}

			// Extract and validate output
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
		sessionId: string,
		options: Omit<Options, "outputFormat"> & { outputFormat?: Options["outputFormat"] },
		callbacks?: IAgentCallbacks<TOutput>,
	): Promise<SDKMessage | undefined> {
		return this.runner.run({
			prompt,
			options: options as Options,
			callbacks: {
				onMessage: (msg) => {
					this.handleMessage(msg, sessionId, callbacks);
				},
			},
		});
	}

	/**
	 * Handle a message from the runner, mapping to callbacks and EventBus.
	 */
	private handleMessage<TOutput>(msg: SDKMessage, sessionId: string, callbacks?: IAgentCallbacks<TOutput>): void {
		// Map SDK message to AgentEvents (legacy)
		const events = mapSdkMessageToEvents(msg, this.name, sessionId);

		for (const event of events) {
			// Publish to legacy EventBus
			this.publishToEventBus(event);

			// Fire appropriate callback
			this.fireCallback(event, msg, callbacks);
		}

		// Also emit to unified bus if available (T020)
		if (this.unifiedBus) {
			const unifiedEvents = mapSdkMessageToUnifiedEvents(msg, this.name);
			for (const event of unifiedEvents) {
				try {
					// Emit with agent context override
					this.unifiedBus.emit(event, { agent: { name: this.name } });
				} catch {
					// Silently ignore unified bus errors
				}
			}
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
	 * Fire callbacks based on event type.
	 */
	private fireCallback<TOutput>(event: AgentEvent, _msg: SDKMessage, callbacks?: IAgentCallbacks<TOutput>): void {
		if (!callbacks) return;

		try {
			switch (event.event_type) {
				case EventTypeConst.TEXT:
					if (event.content && callbacks.onText) {
						callbacks.onText(event.content, false);
					}
					break;

				case EventTypeConst.THINKING:
					if (event.content && callbacks.onThinking) {
						callbacks.onThinking(event.content);
					}
					break;

				case EventTypeConst.TOOL_CALL:
					if (event.tool_name && callbacks.onToolCall) {
						callbacks.onToolCall({
							toolName: event.tool_name,
							input: event.tool_input ?? {},
						});
					}
					break;

				case EventTypeConst.TOOL_RESULT:
					if (event.tool_result && callbacks.onToolResult) {
						callbacks.onToolResult({
							content: event.tool_result,
							isError: event.is_error,
						});
					}
					break;

				case EventTypeConst.TOOL_PROGRESS:
					if (event.tool_name && callbacks.onProgress) {
						callbacks.onProgress({
							toolName: event.tool_name,
							elapsedSeconds: (event.metadata?.elapsed_seconds as number) ?? 0,
						});
					}
					break;

				case EventTypeConst.RESULT:
					// onComplete is fired in processResult
					break;

				case EventTypeConst.ERROR:
					if (event.content && callbacks.onError) {
						callbacks.onError({
							message: event.content,
						});
					}
					break;
			}
		} catch {
			// Silently ignore callback errors
		}
	}

	/**
	 * Publish event to EventBus if available.
	 */
	private publishToEventBus(event: AgentEvent): void {
		if (this.eventBus) {
			try {
				this.eventBus.publish(event);
			} catch {
				// Silently ignore EventBus errors
			}
		}
	}

	/**
	 * Process the final result, firing onComplete callback.
	 */
	private processResult<TOutput>(
		result: SDKMessage | undefined,
		startTime: number,
		callbacks?: IAgentCallbacks<TOutput>,
	): TOutput {
		const durationMs = Date.now() - startTime;

		if (result && result.type === "result") {
			const isSuccess = result.subtype === "success";

			// Build usage stats
			const usage: TokenUsage = {
				inputTokens: result.usage.input_tokens,
				outputTokens: result.usage.output_tokens,
				cacheReadInputTokens: result.usage.cache_read_input_tokens,
				cacheCreationInputTokens: result.usage.cache_creation_input_tokens,
			};

			// Fire onComplete
			if (callbacks?.onComplete) {
				const agentResult: AgentResult<TOutput> = {
					success: isSuccess,
					output: isSuccess ? (result.structured_output as TOutput) : undefined,
					usage,
					durationMs,
					errors: !isSuccess ? result.errors : undefined,
				};
				callbacks.onComplete(agentResult);
			}

			if (isSuccess) {
				return result.structured_output as TOutput;
			}

			throw new Error(`Agent execution failed: ${result.errors?.join(", ") ?? "Unknown error"}`);
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
