/**
 * Monologue Service Contract
 *
 * Core service interface for narrative generation.
 *
 * @module contracts/monologue-service
 */

import type { AgentEvent, MonologueConfig, NarrativeEntry } from "./types.js";

// ============================================================================
// MONOLOGUE SERVICE INTERFACE
// ============================================================================

/**
 * Service that buffers agent events and generates narratives.
 *
 * Each decorated method gets its own service instance via closure scope.
 * The service:
 * 1. Receives events from EventBus subscription
 * 2. Buffers events until threshold reached
 * 3. Calls IMonologueLLM to generate narrative
 * 4. The LLM decides whether to narrate or wait
 * 5. Maintains history for context continuity
 */
export interface IMonologueService {
	/**
	 * Add an event to the buffer.
	 *
	 * If buffer size >= maxBufferSize, forces LLM response.
	 * If buffer size >= minBufferSize, asks LLM (may wait).
	 *
	 * @param event - The agent event to buffer
	 */
	addEvent(event: AgentEvent): Promise<void>;

	/**
	 * Check if we should ask the LLM based on current buffer size.
	 *
	 * @returns true if buffer.length >= minBufferSize
	 */
	shouldAskLLM(): boolean;

	/**
	 * Check if we must force the LLM to respond.
	 *
	 * @returns true if buffer.length >= maxBufferSize
	 */
	mustFlush(): boolean;

	/**
	 * Ask the LLM to generate a narrative.
	 *
	 * The LLM may return:
	 * - Narrative text → emit it, clear buffer, add to history
	 * - "" or "..." → keep buffering (LLM wants more context)
	 *
	 * @param force - If true, LLM must respond (final flush)
	 * @returns Generated NarrativeEntry, or null if LLM deferred
	 */
	generateNarrative(force?: boolean): Promise<NarrativeEntry | null>;

	/**
	 * Final flush - called at method completion.
	 *
	 * Forces the LLM to respond with a summary.
	 * Clears buffer and returns final narrative.
	 */
	finalFlush(): Promise<NarrativeEntry | null>;

	/**
	 * Get current narrative history for context injection.
	 */
	getHistory(): string[];

	/**
	 * Clear buffer and history.
	 */
	reset(): void;

	/**
	 * Get current configuration.
	 */
	getConfig(): MonologueConfig;

	/**
	 * Get current buffer size.
	 */
	getBufferSize(): number;
}

// ============================================================================
// MONOLOGUE LLM INTERFACE
// ============================================================================

/**
 * Interface for the LLM that generates narratives.
 *
 * The LLM is the intelligent narrator - it decides:
 * - When to narrate vs wait for more context
 * - How to summarize multiple events coherently
 * - How to maintain continuity with history
 */
export interface IMonologueLLM {
	/**
	 * Generate narrative text from buffered events.
	 *
	 * The LLM receives:
	 * - Formatted events (tool calls, results, text)
	 * - Previous narrative history for continuity
	 * - System prompt with narration guidelines
	 *
	 * Returns:
	 * - Narrative text → emit immediately
	 * - "" or "..." → wait for more context
	 *
	 * @param events - Buffered agent events
	 * @param history - Previous narratives for context
	 * @param config - Generation configuration
	 * @param isFirst - True if this is the first event (always narrate)
	 * @param isFinal - True if method is completing (must narrate)
	 * @returns Narrative text or wait signal
	 */
	generate(
		events: AgentEvent[],
		history: string[],
		config: MonologueConfig,
		isFirst: boolean,
		isFinal: boolean,
	): Promise<string>;
}

// ============================================================================
// CALLBACK INTERFACE
// ============================================================================

/**
 * Callback for receiving generated narratives.
 */
export interface MonologueCallback {
	onNarrative(entry: NarrativeEntry): void;
	onError?(error: Error, events: AgentEvent[]): void;
}

// ============================================================================
// SERVICE OPTIONS
// ============================================================================

/**
 * Options for creating a MonologueService instance.
 */
export interface MonologueServiceOptions {
	config: MonologueConfig;
	scope: string;
	sessionId: string;
	callback?: MonologueCallback;
}
