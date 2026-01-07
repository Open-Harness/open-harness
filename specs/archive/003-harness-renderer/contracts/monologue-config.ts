/**
 * Monologue Configuration Contract
 *
 * Defines configuration for the @AnthropicMonologue decorator
 * and monologue generation.
 *
 * @module contracts/monologue-config
 */

// ============================================================================
// MONOLOGUE CONFIGURATION
// ============================================================================

/**
 * Configuration for the @AnthropicMonologue decorator.
 *
 * Controls when and how narratives are generated from agent events.
 */
export interface MonologueConfig {
	/**
	 * Minimum number of events to buffer before considering generation.
	 * The system prompt may still decide to wait for more events.
	 * @default 1
	 */
	minBufferSize?: number;

	/**
	 * Maximum number of events to buffer before forcing generation.
	 * @default 10
	 */
	maxBufferSize?: number;

	/**
	 * Maximum number of previous monologues to include in history.
	 * These get re-injected into the system prompt for context.
	 * @default 5
	 */
	historySize?: number;

	/**
	 * Model to use for monologue generation.
	 * @default "haiku"
	 */
	model?: "haiku" | "sonnet" | "opus";

	/**
	 * Custom system prompt for monologue generation.
	 * If provided, overrides the default prompt.
	 *
	 * The prompt receives:
	 * - {{events}} — Recent events to summarize
	 * - {{history}} — Previous monologues for context
	 * - {{agentName}} — Name of the agent
	 *
	 * The prompt can instruct the LLM to:
	 * - Generate immediately, or
	 * - Return empty string to wait for more events
	 */
	systemPrompt?: string;
}

// ============================================================================
// PRESET PROMPTS
// ============================================================================

/**
 * Default monologue system prompt.
 *
 * Generates concise, first-person summaries.
 */
export const DEFAULT_MONOLOGUE_PROMPT = `You are the internal monologue of {{agentName}}, an AI coding agent.

Your job is to provide brief, first-person summaries of what you (the agent) are doing.
These summaries help humans follow your thought process.

## Guidelines

1. Write in first person ("I read...", "I'm creating...", "I found...")
2. Be concise - 1-2 sentences max
3. Focus on WHAT you accomplished, not HOW
4. Reference previous monologues for continuity (don't repeat yourself)
5. If the events don't have enough context for a meaningful summary, respond with just "..."

## Examples

Good: "I read the config file and found the database connection settings."
Good: "I'm implementing the user authentication endpoint now."
Good: "Found a bug in the validation logic - fixing it."

Bad: "I called the Read tool on package.json and got the contents back." (too mechanical)
Bad: "..." then later "I did many things." (lost context)

## When to Wait

Respond with just "..." if:
- Only a single tool call with no result yet
- Events don't form a coherent action
- You need more context to say something meaningful

When you DO generate, make it count - summarize the complete action.`;

/**
 * Terse monologue prompt.
 *
 * Ultra-short summaries (5 words or less).
 */
export const TERSE_MONOLOGUE_PROMPT = `You are {{agentName}}. Summarize actions in 5 words or less.
Examples: "Reading config." | "Writing tests." | "Fixed the bug."
If unclear, respond "..."`;

/**
 * Verbose monologue prompt.
 *
 * Educational style with reasoning.
 */
export const VERBOSE_MONOLOGUE_PROMPT = `You are {{agentName}}, explaining your actions to a junior developer.
Explain what you're doing and WHY in 2-3 sentences.
Include reasoning and any decisions you made.
If not enough context, respond "..."`;

// ============================================================================
// CALLBACK EXTENSION
// ============================================================================

/**
 * Extended callback interface with monologue support.
 *
 * This extends IAgentCallbacks with the onMonologue callback.
 */
export interface MonologueCallbacks {
	/**
	 * Fired when the agent generates a narrative summary.
	 *
	 * @param text - The narrative text in first person
	 * @param metadata - Optional metadata about generation
	 */
	onMonologue?: (text: string, metadata?: MonologueMetadata) => void;
}

/**
 * Metadata about monologue generation.
 */
export interface MonologueMetadata {
	/** Number of events that were summarized */
	eventCount: number;
	/** Current length of monologue history */
	historyLength: number;
	/** True if this is the final flush at end of execution */
	isFinal?: boolean;
}
