/**
 * Event to Message Projection
 *
 * This module provides the `projectEventsToMessages` function that transforms
 * a sequence of events into AI SDK-compatible chat messages.
 *
 * @module @core-v2/message/projection
 */

import type { AnyEvent, EventId } from "../event/Event.js";
import {
	generateMessageId,
	type Message,
	type MessageRole,
	type ProjectionOptions,
	type ToolInvocation,
} from "./Message.js";

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Mutable message builder for accumulating content during projection.
 */
interface MessageBuilder {
	id: string;
	role: MessageRole;
	content: string;
	name?: string;
	toolInvocations: ToolInvocation[];
	_events: EventId[];
}

// ============================================================================
// Event Type Guards
// ============================================================================

interface UserInputPayload {
	text: string;
	sessionId?: string;
}

interface TextDeltaPayload {
	delta: string;
	agentName?: string;
}

interface TextCompletePayload {
	fullText: string;
	agentName?: string;
}

interface AgentStartedPayload {
	agentName: string;
	reason?: string;
}

interface ToolCalledPayload {
	toolName: string;
	toolId: string;
	input: unknown;
}

interface ToolResultPayload {
	toolId: string;
	output: unknown;
	isError: boolean;
}

function isUserInputEvent(event: AnyEvent): event is AnyEvent & { payload: UserInputPayload } {
	return event.name === "user:input" && typeof (event.payload as UserInputPayload)?.text === "string";
}

function isTextDeltaEvent(event: AnyEvent): event is AnyEvent & { payload: TextDeltaPayload } {
	return event.name === "text:delta" && typeof (event.payload as TextDeltaPayload)?.delta === "string";
}

function isTextCompleteEvent(event: AnyEvent): event is AnyEvent & { payload: TextCompletePayload } {
	return event.name === "text:complete" && typeof (event.payload as TextCompletePayload)?.fullText === "string";
}

function isAgentStartedEvent(event: AnyEvent): event is AnyEvent & { payload: AgentStartedPayload } {
	return event.name === "agent:started" && typeof (event.payload as AgentStartedPayload)?.agentName === "string";
}

function isToolCalledEvent(event: AnyEvent): event is AnyEvent & { payload: ToolCalledPayload } {
	const payload = event.payload as ToolCalledPayload;
	return event.name === "tool:called" && typeof payload?.toolName === "string" && typeof payload?.toolId === "string";
}

function isToolResultEvent(event: AnyEvent): event is AnyEvent & { payload: ToolResultPayload } {
	const payload = event.payload as ToolResultPayload;
	return event.name === "tool:result" && typeof payload?.toolId === "string";
}

// ============================================================================
// Projection Functions
// ============================================================================

/**
 * Finalizes a message builder into an immutable Message.
 */
function finalizeMessage(builder: MessageBuilder, includeEventIds: boolean): Message {
	// Build the message with all properties that have values
	const message: Message = {
		id: builder.id,
		role: builder.role,
		content: builder.content,
		_events: includeEventIds ? [...builder._events] : [],
		// Only include optional fields if they have values
		...(builder.name !== undefined && { name: builder.name }),
		...(builder.toolInvocations.length > 0 && { toolInvocations: [...builder.toolInvocations] }),
	};

	return message;
}

/**
 * Creates a new message builder.
 */
function createMessageBuilder(
	role: MessageRole,
	content: string,
	eventId: EventId,
	idGenerator: () => string,
	name?: string,
): MessageBuilder {
	return {
		id: idGenerator(),
		role,
		content,
		name,
		toolInvocations: [],
		_events: [eventId],
	};
}

/**
 * Projects a sequence of events into AI SDK-compatible messages.
 *
 * This function processes events in order and accumulates them into messages:
 *
 * - **user:input** → Creates a new user message with content from `payload.text`
 * - **agent:started** → Starts a new assistant message with `name` from agent
 * - **text:delta** → Appends `payload.delta` to current assistant message content
 * - **text:complete** → Finalizes assistant message (replaces content with `payload.fullText`)
 * - **tool:called** → Adds a pending tool invocation to current assistant message
 * - **tool:result** → Updates the matching tool invocation with result
 *
 * @param events - Array of events to project (in chronological order)
 * @param options - Projection options
 * @returns Array of projected messages
 *
 * @example
 * ```typescript
 * import { projectEventsToMessages } from "@open-harness/core-v2";
 *
 * const events = [
 *   createEvent("user:input", { text: "Hello" }),
 *   createEvent("agent:started", { agentName: "chat" }),
 *   createEvent("text:delta", { delta: "Hi " }),
 *   createEvent("text:delta", { delta: "there!" }),
 *   createEvent("text:complete", { fullText: "Hi there!" }),
 * ];
 *
 * const messages = projectEventsToMessages(events);
 * // [
 * //   { id: "msg-1", role: "user", content: "Hello", _events: [...] },
 * //   { id: "msg-2", role: "assistant", content: "Hi there!", name: "chat", _events: [...] }
 * // ]
 * ```
 */
export function projectEventsToMessages(
	events: readonly AnyEvent[],
	options: ProjectionOptions = {},
): readonly Message[] {
	const { includeEventIds = true, generateId = generateMessageId } = options;

	const messages: Message[] = [];
	let currentAssistantMessage: MessageBuilder | null = null;

	for (const event of events) {
		// user:input → Create new user message
		if (isUserInputEvent(event)) {
			// Finalize any pending assistant message first
			if (currentAssistantMessage !== null) {
				messages.push(finalizeMessage(currentAssistantMessage, includeEventIds));
				currentAssistantMessage = null;
			}

			// Create and immediately finalize user message
			const userMessage = createMessageBuilder("user", event.payload.text, event.id, generateId);
			messages.push(finalizeMessage(userMessage, includeEventIds));
			continue;
		}

		// agent:started → Start new assistant message
		if (isAgentStartedEvent(event)) {
			// Finalize any pending assistant message first
			if (currentAssistantMessage !== null) {
				messages.push(finalizeMessage(currentAssistantMessage, includeEventIds));
			}

			// Start new assistant message with agent name
			currentAssistantMessage = createMessageBuilder("assistant", "", event.id, generateId, event.payload.agentName);
			continue;
		}

		// text:delta → Append to current assistant message
		if (isTextDeltaEvent(event)) {
			if (currentAssistantMessage === null) {
				// Create assistant message if we get delta without agent:started
				currentAssistantMessage = createMessageBuilder(
					"assistant",
					event.payload.delta,
					event.id,
					generateId,
					event.payload.agentName,
				);
			} else {
				// Append delta to existing message
				currentAssistantMessage.content += event.payload.delta;
				currentAssistantMessage._events.push(event.id);
			}
			continue;
		}

		// text:complete → Finalize assistant message
		if (isTextCompleteEvent(event)) {
			if (currentAssistantMessage !== null) {
				// Replace accumulated content with final text
				currentAssistantMessage.content = event.payload.fullText;
				currentAssistantMessage._events.push(event.id);
				// Note: We don't finalize here - wait for next user input or end
			} else {
				// Create message from complete event if no current message
				currentAssistantMessage = createMessageBuilder(
					"assistant",
					event.payload.fullText,
					event.id,
					generateId,
					event.payload.agentName,
				);
			}
			continue;
		}

		// tool:called → Add pending tool invocation
		if (isToolCalledEvent(event)) {
			if (currentAssistantMessage === null) {
				// Create assistant message if we get tool call without agent:started
				currentAssistantMessage = createMessageBuilder("assistant", "", event.id, generateId);
			} else {
				currentAssistantMessage._events.push(event.id);
			}

			// Add pending tool invocation
			const toolInvocation: ToolInvocation = {
				toolCallId: event.payload.toolId,
				toolName: event.payload.toolName,
				args: event.payload.input,
				state: "pending",
			};
			currentAssistantMessage.toolInvocations.push(toolInvocation);
			continue;
		}

		// tool:result → Update tool invocation
		if (isToolResultEvent(event)) {
			if (currentAssistantMessage !== null) {
				currentAssistantMessage._events.push(event.id);

				// Find and update matching tool invocation
				const toolIndex = currentAssistantMessage.toolInvocations.findIndex(
					(t) => t.toolCallId === event.payload.toolId,
				);

				if (toolIndex !== -1) {
					const existing = currentAssistantMessage.toolInvocations[toolIndex];
					if (existing) {
						currentAssistantMessage.toolInvocations[toolIndex] = {
							toolCallId: existing.toolCallId,
							toolName: existing.toolName,
							args: existing.args,
							result: event.payload.output,
							state: event.payload.isError ? "error" : "result",
						};
					}
				}
			}
			continue;
		}

		// Other events: just add to current assistant message's event list if exists
		if (currentAssistantMessage !== null) {
			currentAssistantMessage._events.push(event.id);
		}
	}

	// Finalize any remaining assistant message
	if (currentAssistantMessage !== null) {
		messages.push(finalizeMessage(currentAssistantMessage, includeEventIds));
	}

	return messages;
}
