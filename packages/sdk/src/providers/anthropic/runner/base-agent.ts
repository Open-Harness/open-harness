/**
 * BaseAgent - Foundation for all agent implementations
 *
 * Uses constructor injection for dependencies (NeedleDI pattern).
 * Pure Promise + Callbacks pattern, no async generators.
 *
 * @deprecated For new agents, consider using BaseAnthropicAgent from
 * '../agents/base-anthropic-agent.js' which provides typed IAgentCallbacks.
 */

import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { inject, injectable } from "@needle-di/core";
import { type IAgentRunner, IAgentRunnerToken, type IEventBus, IEventBusToken } from "../../../core/tokens.js";
import { mapSdkMessageToEvents } from "./event-mapper.js";
import { type AgentEvent, type CompactData, EventTypeConst, type SessionResult, type StatusData } from "./models.js";

/**
 * Type-safe callbacks for agent events.
 * All callbacks are optional - provide only what you need.
 *
 * @deprecated Use IAgentCallbacks from '../callbacks/types.js' instead.
 */
export type StreamCallbacks = {
	/** Session initialized with model info */
	onSessionStart?: (metadata: Record<string, unknown>, event: AgentEvent) => void;

	/** Text content from assistant */
	onText?: (content: string, event: AgentEvent) => void;

	/** Extended thinking/reasoning */
	onThinking?: (thought: string, event: AgentEvent) => void;

	/** Tool invocation started */
	onToolCall?: (toolName: string, input: Record<string, unknown>, event: AgentEvent) => void;

	/** Tool execution completed */
	onToolResult?: (result: Record<string, unknown>, event: AgentEvent) => void;

	/** Tool execution progress update */
	onToolProgress?: (toolName: string, elapsedSeconds: number, event: AgentEvent) => void;

	/** Context compaction started */
	onCompact?: (data: CompactData, event: AgentEvent) => void;

	/** Status update (e.g., "compacting") */
	onStatus?: (data: StatusData, event: AgentEvent) => void;

	/** Final result with usage stats and structured output */
	onResult?: (result: SessionResult, event: AgentEvent) => void;

	/** Session ended (success or error) */
	onSessionEnd?: (content: string, isError: boolean, event: AgentEvent) => void;

	/** Error occurred */
	onError?: (error: string, event: AgentEvent) => void;
};

/**
 * @deprecated For new agents, consider using BaseAnthropicAgent from
 * '../agents/base-anthropic-agent.js' which provides typed IAgentCallbacks.
 */
@injectable()
export class BaseAgent {
	constructor(
		public readonly name: string,
		protected runner: IAgentRunner = inject(IAgentRunnerToken),
		protected eventBus: IEventBus | null = inject(IEventBusToken, {
			optional: true,
		}) ?? null,
	) {}

	/**
	 * Run the agent with a prompt.
	 *
	 * @param prompt - The prompt to send
	 * @param sessionId - Unique session identifier
	 * @param options - Configuration including callbacks
	 * @returns Promise with the final SDK message
	 */
	async run(
		prompt: string,
		sessionId: string,
		options?: Options & { callbacks?: StreamCallbacks },
	): Promise<SDKMessage | undefined> {
		const { callbacks, ...runnerOptions } = options || {};

		const result = await this.runner.run({
			prompt,
			options: runnerOptions,
			callbacks: {
				onMessage: (msg) => {
					// Use shared event mapper
					const events = mapSdkMessageToEvents(msg, this.name, sessionId);
					for (const event of events) {
						this.fireEventBus(event);
						if (callbacks) {
							this.fireStreamCallback(callbacks, event, msg);
						}
					}
				},
			},
		});

		return result;
	}

	private fireEventBus(event: AgentEvent): void {
		if (this.eventBus) {
			this.eventBus.publish(event);
		}
	}

	/**
	 * Fire stream callbacks based on event type.
	 * This method adapts AgentEvent to StreamCallbacks interface.
	 */
	private fireStreamCallback(callbacks: StreamCallbacks, event: AgentEvent, msg: SDKMessage): void {
		try {
			switch (event.event_type) {
				case EventTypeConst.SESSION_START:
					callbacks.onSessionStart?.(event.metadata || {}, event);
					break;

				case EventTypeConst.TEXT:
					if (event.content) {
						callbacks.onText?.(event.content, event);
					}
					break;

				case EventTypeConst.THINKING:
					if (event.content) {
						callbacks.onThinking?.(event.content, event);
					}
					break;

				case EventTypeConst.TOOL_CALL:
					if (event.tool_name && event.tool_input) {
						callbacks.onToolCall?.(event.tool_name, event.tool_input, event);
					}
					break;

				case EventTypeConst.TOOL_RESULT:
					if (event.tool_result) {
						callbacks.onToolResult?.(event.tool_result, event);
					}
					break;

				case EventTypeConst.TOOL_PROGRESS:
					if (event.tool_name && event.metadata?.elapsed_seconds != null) {
						callbacks.onToolProgress?.(event.tool_name, event.metadata.elapsed_seconds as number, event);
					}
					break;

				case EventTypeConst.COMPACT:
					if (event.metadata) {
						const compactData: CompactData = {
							trigger: event.metadata.trigger as "manual" | "auto",
							pre_tokens: event.metadata.pre_tokens as number,
						};
						callbacks.onCompact?.(compactData, event);
					}
					break;

				case EventTypeConst.STATUS:
					if (event.metadata) {
						const statusData: StatusData = {
							status: event.metadata.status as "compacting" | null,
						};
						callbacks.onStatus?.(statusData, event);
					}
					break;

				case EventTypeConst.RESULT:
					if (msg.type === "result") {
						const sessionResult: SessionResult = {
							success: msg.subtype === "success",
							duration_ms: msg.duration_ms,
							num_turns: msg.num_turns,
							total_cost_usd: msg.total_cost_usd,
							usage: {
								input_tokens: msg.usage.input_tokens,
								output_tokens: msg.usage.output_tokens,
								cache_read_input_tokens: msg.usage.cache_read_input_tokens,
								cache_creation_input_tokens: msg.usage.cache_creation_input_tokens,
							},
							structured_output: msg.subtype === "success" ? msg.structured_output : undefined,
							errors: msg.subtype !== "success" ? msg.errors : undefined,
						};
						callbacks.onResult?.(sessionResult, event);
					}
					break;

				case EventTypeConst.SESSION_END:
					if (event.content) {
						callbacks.onSessionEnd?.(event.content, event.is_error || false, event);
					}
					break;

				case EventTypeConst.ERROR:
					if (event.content) {
						callbacks.onError?.(event.content, event);
					}
					break;
			}
		} catch (_error) {
			// Fire-and-forget: silently ignore callback errors
		}
	}
}
