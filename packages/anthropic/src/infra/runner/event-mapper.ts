/**
 * Event Mapper - Shared SDK message to AgentEvent mapping logic
 *
 * This utility extracts the common event mapping logic that was duplicated
 * in both BaseAgent and BaseAnthropicAgent. Both classes now use this
 * shared implementation to ensure consistent event handling.
 */

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { BaseEvent } from "@openharness/sdk";
import { type AgentEvent, EventTypeConst } from "./models.js";

/**
 * Map an SDK message to AgentEvent(s).
 *
 * A single SDK message may produce multiple events (e.g., result produces
 * both RESULT and SESSION_END events).
 *
 * @param msg - The SDK message to map
 * @param agentName - Name of the agent for event attribution
 * @param sessionId - Session ID (used when SDK message doesn't include one)
 * @returns Array of mapped AgentEvent objects
 */
export function mapSdkMessageToEvents(msg: SDKMessage, agentName: string, sessionId: string): AgentEvent[] {
	const events: AgentEvent[] = [];
	const timestamp = new Date();

	switch (msg.type) {
		case "system":
			if (msg.subtype === "init") {
				events.push({
					timestamp,
					event_type: EventTypeConst.SESSION_START,
					agent_name: agentName,
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
					agent_name: agentName,
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
					agent_name: agentName,
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
							agent_name: agentName,
							content: block.text,
							session_id: sessionId,
						});
					} else if (block.type === "thinking") {
						events.push({
							timestamp,
							event_type: EventTypeConst.THINKING,
							agent_name: agentName,
							content: block.thinking,
							session_id: sessionId,
						});
					} else if (block.type === "tool_use") {
						events.push({
							timestamp,
							event_type: EventTypeConst.TOOL_CALL,
							agent_name: agentName,
							tool_name: block.name,
							tool_input: block.input as Record<string, unknown>,
							content: `Calling tool: ${block.name}`,
							session_id: sessionId,
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
							agent_name: agentName,
							tool_result: {
								content: block.content,
								is_error: block.is_error,
							},
							content: `Tool result: ${String(block.content).slice(0, 100)}`,
							session_id: sessionId,
						});
					}
				}
			}
			break;

		case "tool_progress":
			events.push({
				timestamp,
				event_type: EventTypeConst.TOOL_PROGRESS,
				agent_name: agentName,
				tool_name: msg.tool_name,
				content: `Tool progress: ${msg.tool_name}`,
				session_id: sessionId,
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
				agent_name: agentName,
				content: msg.subtype === "success" ? "Task completed" : "Task failed",
				is_error: msg.subtype !== "success",
				session_id: sessionId,
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
				agent_name: agentName,
				content: msg.subtype === "success" ? "Task completed" : "Task failed",
				is_error: msg.subtype !== "success",
				session_id: sessionId,
				metadata: { usage: msg.usage },
			});
			break;

		default:
			// Unknown message types are intentionally ignored.
			// New SDK message types should be handled explicitly above.
			break;
	}

	return events;
}

/**
 * Map an SDK message to unified BaseEvent(s) for the unified event system.
 *
 * Unlike mapSdkMessageToEvents, this produces events matching the unified
 * event-context.ts types (AgentThinkingEvent, AgentToolStartEvent, etc.)
 * that are emitted via UnifiedEventBus.
 *
 * @param msg - The SDK message to map
 * @param agentName - Name of the agent for event attribution
 * @returns Array of unified BaseEvent objects
 */
export function mapSdkMessageToUnifiedEvents(msg: SDKMessage, agentName: string): BaseEvent[] {
	const events: BaseEvent[] = [];

	switch (msg.type) {
		case "system":
			if (msg.subtype === "init") {
				events.push({
					type: "agent:start",
					agentName,
				});
			}
			break;

		case "assistant":
			if (Array.isArray(msg.message.content)) {
				for (const block of msg.message.content) {
					if (block.type === "text") {
						events.push({
							type: "agent:text",
							content: block.text,
						});
					} else if (block.type === "thinking") {
						events.push({
							type: "agent:thinking",
							content: block.thinking,
						});
					} else if (block.type === "tool_use") {
						events.push({
							type: "agent:tool:start",
							toolName: block.name,
							input: block.input as unknown,
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
							type: "agent:tool:complete",
							toolName: "unknown", // Tool name not available in result
							result: block.content,
							isError: block.is_error,
						});
					}
				}
			}
			break;

		case "result":
			events.push({
				type: "agent:complete",
				agentName,
				success: msg.subtype === "success",
			});
			break;

		default:
			// Unknown message types are intentionally ignored.
			break;
	}

	return events;
}
