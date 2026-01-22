/**
 * Message Module - AI SDK Compatible Chat Messages
 *
 * This module provides types and utilities for projecting events
 * into AI SDK-compatible chat messages for React integration.
 *
 * @module @core-v2/message
 *
 * @example
 * ```typescript
 * import {
 *   Message,
 *   MessageRole,
 *   ToolInvocation,
 *   projectEventsToMessages,
 * } from "@open-harness/core-v2";
 *
 * // Project events into messages
 * const messages = projectEventsToMessages(workflow.events);
 *
 * // Render messages
 * messages.forEach(msg => {
 *   console.log(`${msg.role}: ${msg.content}`);
 * });
 * ```
 */

// Types
export type {
	Message,
	MessageRole,
	ProjectionOptions,
	ToolInvocation,
	ToolInvocationState,
} from "./Message.js";

// Utilities
export { generateMessageId, resetMessageIdCounter } from "./Message.js";

// Projection
export { projectEventsToMessages } from "./projection.js";
