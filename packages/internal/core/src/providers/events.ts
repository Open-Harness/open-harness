/**
 * Unified stream events emitted by providers.
 * 
 * These are provider-agnostic events that all providers can emit.
 * The adapter will map these to RuntimeEventPayload types.
 */
export type StreamEvent =
	| TextStreamEvent
	| ThinkingStreamEvent
	| ToolStreamEvent
	| ErrorStreamEvent;

/**
 * Text content from the provider.
 */
export interface TextStreamEvent {
	type: "text";
	/** Text content */
	content: string;
	/** Is this a delta (incremental) or complete text? */
	delta?: boolean;
}

/**
 * Thinking/reasoning content from the provider.
 * 
 * Some providers (like Claude) expose their reasoning process.
 */
export interface ThinkingStreamEvent {
	type: "thinking";
	/** Thinking content */
	content: string;
	/** Is this a delta (incremental) or complete thinking? */
	delta?: boolean;
}

/**
 * Tool call event.
 */
export interface ToolStreamEvent {
	type: "tool";
	/** Tool name */
	name: string;
	/** Phase of tool execution */
	phase: "start" | "complete";
	/** Tool input (on start) or output (on complete) */
	data: unknown;
	/** Error message if tool failed */
	error?: string;
}

/**
 * Error event.
 * 
 * Providers can emit errors as events before throwing.
 * This allows streaming partial results before failure.
 */
export interface ErrorStreamEvent {
	type: "error";
	/** Error code */
	code: string;
	/** Error message */
	message: string;
}
