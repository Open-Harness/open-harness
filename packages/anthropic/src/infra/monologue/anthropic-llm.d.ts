/**
 * Anthropic Monologue LLM Implementation
 *
 * Uses @anthropic-ai/claude-agent-sdk for Claude Code subscription auth.
 * This is intentionally lightweight - uses the SDK's query function.
 *
 * @module monologue/anthropic-llm
 */
import type { IMonologueLLM, MonologueAgentEvent, MonologueConfig } from "@openharness/sdk";
/**
 * Production IMonologueLLM implementation using Claude Agent SDK.
 *
 * Features:
 * - Uses Haiku by default for fast, cheap narratives
 * - Works with Claude Code subscription (no API key needed)
 * - Handles wait signal ("...") as a valid response
 */
export declare class AnthropicMonologueLLM implements IMonologueLLM {
    private timeout;
    constructor(timeout?: number);
    generate(events: MonologueAgentEvent[], history: string[], config: MonologueConfig, isFirst: boolean, isFinal: boolean): Promise<string>;
    /**
     * Execute the query using the Claude Agent SDK.
     */
    private executeQuery;
    /**
     * Format the user message with events and context.
     */
    private formatUserMessage;
    /**
     * Format a single event for the LLM.
     */
    private formatEvent;
    private truncate;
    private createTimeoutPromise;
}
