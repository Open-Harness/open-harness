/**
 * Message Types - AI SDK Compatible Chat Message Types
 *
 * This module defines the Message interface and related types for projecting
 * events into AI SDK-compatible chat messages. Used for React integration.
 *
 * @module @core-v2/message
 */

import type { EventId } from "../event/Event.js";

// ============================================================================
// Message Role
// ============================================================================

/**
 * Message role - compatible with Vercel AI SDK.
 *
 * - `user`: Messages from the user
 * - `assistant`: Messages from AI agents
 * - `system`: System messages (instructions, etc.)
 * - `tool`: Tool execution results
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

// ============================================================================
// Tool Invocation
// ============================================================================

/**
 * Tool invocation state.
 *
 * - `pending`: Tool has been called but no result yet
 * - `result`: Tool execution completed successfully
 * - `error`: Tool execution failed
 */
export type ToolInvocationState = "pending" | "result" | "error";

/**
 * Tool invocation within a message.
 *
 * Represents a tool call and its result, matching Vercel AI SDK's structure.
 *
 * @example
 * ```typescript
 * const toolInvocation: ToolInvocation = {
 *   toolCallId: "call-123",
 *   toolName: "get_weather",
 *   args: { location: "New York" },
 *   result: { temp: 72, condition: "sunny" },
 *   state: "result",
 * };
 * ```
 */
export interface ToolInvocation {
	/** Unique tool call ID (from LLM) */
	readonly toolCallId: string;
	/** Name of the tool that was called */
	readonly toolName: string;
	/** Arguments passed to the tool */
	readonly args: unknown;
	/** Tool result (present when state is "result" or "error") */
	readonly result?: unknown;
	/** Current state of the invocation */
	readonly state: ToolInvocationState;
}

// ============================================================================
// Message Interface
// ============================================================================

/**
 * Message - AI SDK-compatible chat message.
 *
 * Messages are projected from Events for React integration. The projection
 * accumulates streaming events (text:delta) into complete messages.
 *
 * **Projection Rules:**
 * - `user:input` → `{ role: "user", content: payload.text }`
 * - `text:delta` → Append `payload.delta` to current assistant message
 * - `text:complete` → Finalize assistant message with `payload.fullText`
 * - `agent:started` → Start new assistant message with `name` from agent
 * - `tool:called` → Add to `toolInvocations[]` with state: "pending"
 * - `tool:result` → Update matching toolInvocation result and state
 *
 * @remarks
 * The `_events` array provides traceability back to source events.
 * This enables time-travel debugging: given a message, you can find
 * exactly which events produced it.
 *
 * @example
 * ```typescript
 * // User message
 * const userMsg: Message = {
 *   id: "msg-1",
 *   role: "user",
 *   content: "What's the weather?",
 *   _events: ["event-1"],
 * };
 *
 * // Assistant message with tool call
 * const assistantMsg: Message = {
 *   id: "msg-2",
 *   role: "assistant",
 *   content: "Let me check the weather for you.",
 *   name: "weather-agent",
 *   toolInvocations: [{
 *     toolCallId: "call-1",
 *     toolName: "get_weather",
 *     args: { location: "New York" },
 *     result: { temp: 72, condition: "sunny" },
 *     state: "result",
 *   }],
 *   _events: ["event-2", "event-3", "event-4"],
 * };
 * ```
 */
export interface Message {
	/** Unique message identifier */
	readonly id: string;
	/** Message role (user, assistant, system, tool) */
	readonly role: MessageRole;
	/** Message content (accumulated from text:delta events for assistant) */
	readonly content: string;
	/** Agent name for assistant messages (from agent:started event) */
	readonly name?: string;
	/** Tool invocations within this message */
	readonly toolInvocations?: readonly ToolInvocation[];
	/** Source event IDs for traceability (for time-travel debugging) */
	readonly _events: readonly EventId[];
}

// ============================================================================
// Projection Options
// ============================================================================

/**
 * Options for message projection.
 *
 * @example
 * ```typescript
 * const messages = projectEventsToMessages(events, {
 *   includeEventIds: true,
 *   generateId: () => crypto.randomUUID(),
 * });
 * ```
 */
export interface ProjectionOptions {
	/** Whether to include _events field (default: true) */
	readonly includeEventIds?: boolean;
	/** Custom ID generator for messages */
	readonly generateId?: () => string;
}

// ============================================================================
// Message ID Generation
// ============================================================================

let messageIdCounter = 0;

/**
 * Generates a unique message ID.
 * Uses a simple counter for deterministic IDs during testing.
 *
 * @returns A unique message ID string
 */
export function generateMessageId(): string {
	return `msg-${++messageIdCounter}`;
}

/**
 * Resets the message ID counter.
 * Useful for testing to ensure deterministic IDs.
 */
export function resetMessageIdCounter(): void {
	messageIdCounter = 0;
}
