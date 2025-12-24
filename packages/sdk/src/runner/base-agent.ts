/**
 * BaseAgent - Foundation for all agent implementations
 *
 * Uses constructor injection for dependencies (NeedleDI pattern).
 * Pure Promise + Callbacks pattern, no async generators.
 */

import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { inject, injectable } from "@needle-di/core";
import { type IAgentRunner, IAgentRunnerToken, type IEventBus, IEventBusToken } from "../core/tokens.js";
import { type AgentEvent, type CompactData, EventTypeConst, type SessionResult, type StatusData } from "./models.js";

/**
 * Type-safe callbacks for agent events.
 * All callbacks are optional - provide only what you need.
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
		_sessionId: string,
		options?: Options & { callbacks?: StreamCallbacks },
	): Promise<SDKMessage | undefined> {
		const { callbacks, ...runnerOptions } = options || {};

		const result = await this.runner.run({
			prompt,
			options: runnerOptions,
			callbacks: {
				onMessage: (msg) => {
					const events = this.mapMessageToEvents(msg);
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

	private mapMessageToEvents(msg: SDKMessage): AgentEvent[] {
		const events: AgentEvent[] = [];
		const timestamp = new Date();

		switch (msg.type) {
			case "system":
				if (msg.subtype === "init") {
					events.push({
						timestamp,
						event_type: EventTypeConst.SESSION_START,
						agent_name: this.name,
						content: `Session started: ${msg.session_id}`,
						session_id: msg.session_id,
						metadata: {
							model: msg.model,
							tools: msg.tools,
							cwd: msg.cwd,
							permission_mode: msg.permissionMode,
							slash_commands: msg.slash_commands,
						},
					});
				} else if (msg.subtype === "compact_boundary") {
					events.push({
						timestamp,
						event_type: EventTypeConst.COMPACT,
						agent_name: this.name,
						content: `Context compacted (${msg.compact_metadata.trigger})`,
						session_id: msg.session_id,
						metadata: {
							trigger: msg.compact_metadata.trigger,
							pre_tokens: msg.compact_metadata.pre_tokens,
						},
					});
				} else if (msg.subtype === "status") {
					events.push({
						timestamp,
						event_type: EventTypeConst.STATUS,
						agent_name: this.name,
						content: `Status: ${msg.status ?? "idle"}`,
						session_id: msg.session_id,
						metadata: {
							status: msg.status,
						},
					});
				}
				break;

			case "assistant":
				if (Array.isArray(msg.message.content)) {
					for (const block of msg.message.content) {
						if (block.type === "text") {
							events.push({
								timestamp,
								event_type: EventTypeConst.TEXT,
								agent_name: this.name,
								content: block.text,
								session_id: msg.session_id,
							});
						} else if (block.type === "thinking") {
							events.push({
								timestamp,
								event_type: EventTypeConst.THINKING,
								agent_name: this.name,
								content: block.thinking,
								session_id: msg.session_id,
							});
						} else if (block.type === "tool_use") {
							events.push({
								timestamp,
								event_type: EventTypeConst.TOOL_CALL,
								agent_name: this.name,
								tool_name: block.name,
								tool_input: block.input as Record<string, unknown>,
								content: `Calling tool: ${block.name}`,
								session_id: msg.session_id,
							});
						}
					}
				}
				break;

			case "user":
				if (Array.isArray(msg.message.content)) {
					for (const block of msg.message.content) {
						if (block.type === "tool_result") {
							events.push({
								timestamp,
								event_type: EventTypeConst.TOOL_RESULT,
								agent_name: this.name,
								tool_result: {
									content: block.content,
									is_error: block.is_error,
								},
								content: `Tool result: ${String(block.content).slice(0, 100)}`,
								session_id: msg.session_id,
							});
						}
					}
				}
				break;

			case "tool_progress":
				events.push({
					timestamp,
					event_type: EventTypeConst.TOOL_PROGRESS,
					agent_name: this.name,
					tool_name: msg.tool_name,
					content: `Tool progress: ${msg.tool_name}`,
					session_id: msg.session_id,
					metadata: {
						elapsed_seconds: msg.elapsed_time_seconds,
						tool_use_id: msg.tool_use_id,
					},
				});
				break;

			case "result":
				// Emit both RESULT and SESSION_END for result messages
				events.push({
					timestamp,
					event_type: EventTypeConst.RESULT,
					agent_name: this.name,
					content: msg.subtype === "success" ? "Task completed" : "Task failed",
					is_error: msg.subtype !== "success",
					session_id: msg.session_id,
					metadata: {
						subtype: msg.subtype,
						usage: msg.usage,
						duration_ms: msg.duration_ms,
						num_turns: msg.num_turns,
						total_cost_usd: msg.total_cost_usd,
					},
				});
				events.push({
					timestamp,
					event_type: EventTypeConst.SESSION_END,
					agent_name: this.name,
					content: msg.subtype === "success" ? "Task completed" : "Task failed",
					is_error: msg.subtype !== "success",
					session_id: msg.session_id,
					metadata: { usage: msg.usage },
				});
				break;
		}

		return events;
	}
}
