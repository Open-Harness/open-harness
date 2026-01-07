/**
 * Monologue System Type Definitions
 *
 * Core types for the monologue system.
 * NOTE: These are ONLY for agent narratives, not harness progress events.
 *
 * @module contracts/types
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration for monologue generation behavior.
 *
 * The LLM decides when to narrate based on its system prompt.
 * These thresholds are guardrails, not triggers.
 */
export interface MonologueConfig {
	/**
	 * Minimum events to buffer before asking the LLM.
	 * Below this threshold, we wait (don't bother the LLM).
	 * @default 1
	 */
	minBufferSize: number;

	/**
	 * Maximum events to buffer before forcing the LLM to respond.
	 * Memory protection - prevents unbounded growth.
	 * @default 10
	 */
	maxBufferSize: number;

	/**
	 * Number of previous narratives to include as context.
	 * Enables continuity: "Now that I've found X, I'm doing Y"
	 * @default 5
	 */
	historySize: number;

	/**
	 * Model to use for narrative generation.
	 * @default "haiku"
	 */
	model: "haiku" | "sonnet" | "opus";

	/**
	 * Custom system prompt. If omitted, uses DEFAULT_MONOLOGUE_PROMPT.
	 *
	 * The prompt should instruct the LLM:
	 * - When to narrate vs wait (return "...")
	 * - Tone and perspective (first-person, concise)
	 * - How to use history for continuity
	 */
	systemPrompt?: string;
}

/**
 * Default configuration values.
 */
export const DEFAULT_MONOLOGUE_CONFIG: MonologueConfig = {
	minBufferSize: 1,
	maxBufferSize: 10,
	historySize: 5,
	model: "haiku",
};

// ============================================================================
// EVENTS (from agent execution)
// ============================================================================

/**
 * Event types from agent execution.
 */
export type AgentEventType = "tool_call" | "tool_result" | "text" | "thinking" | "completion";

/**
 * An event from agent execution, buffered for narrative synthesis.
 */
export interface AgentEvent {
	event_type: AgentEventType;
	agent_name: string;
	session_id: string;
	timestamp: number;
	payload: AgentEventPayload;
}

/**
 * Discriminated union of event payloads.
 */
export type AgentEventPayload = ToolCallPayload | ToolResultPayload | TextPayload | ThinkingPayload | CompletionPayload;

export interface ToolCallPayload {
	type: "tool_call";
	tool_name: string;
	tool_input: unknown;
}

export interface ToolResultPayload {
	type: "tool_result";
	tool_name: string;
	result: unknown;
	error?: string;
}

export interface TextPayload {
	type: "text";
	content: string;
}

export interface ThinkingPayload {
	type: "thinking";
	content: string;
}

export interface CompletionPayload {
	type: "completion";
	summary?: string;
}

// ============================================================================
// NARRATIVE OUTPUT (LLM-generated only)
// ============================================================================

/**
 * Valid agent names for narrative attribution.
 *
 * NOTE: "Harness" is NOT included. Harness emits progress events,
 * not narratives. Narratives are LLM-generated from agent work.
 */
export type NarrativeAgentName = "Parser" | "Coder" | "Reviewer" | "Validator";

/**
 * Output from narrative generation.
 *
 * This represents what the LLM "said" about the agent's work.
 * First-person, natural language.
 */
export interface NarrativeEntry {
	timestamp: number;
	agentName: NarrativeAgentName;
	taskId: string | null;
	text: string;
	metadata?: NarrativeMetadata;
}

/**
 * Metadata about narrative generation.
 */
export interface NarrativeMetadata {
	/** Number of events that were summarized */
	eventCount: number;
	/** Current length of narrative history */
	historyLength: number;
	/** True if this is the final flush at method completion */
	isFinal: boolean;
	/** Model used for generation */
	model: string;
	/** Generation latency in milliseconds */
	latencyMs: number;
}

// ============================================================================
// DECORATOR OPTIONS
// ============================================================================

/**
 * Options for the @Monologue decorator.
 */
export interface MonologueDecoratorOptions {
	/**
	 * Scope name for this decorated method.
	 * Used for EventBus filtering and narrative attribution.
	 */
	scope: NarrativeAgentName;

	/**
	 * Override default configuration for this scope.
	 */
	config?: Partial<MonologueConfig>;
}
