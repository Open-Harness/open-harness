/**
 * Anthropic Monologue LLM Implementation
 *
 * Uses @anthropic-ai/claude-agent-sdk for Claude Code subscription auth.
 * This is intentionally lightweight - uses the SDK's query function.
 *
 * @module monologue/anthropic-llm
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { injectable } from "@needle-di/core";
import { DEFAULT_MONOLOGUE_PROMPT } from "./prompts.js";
import type { AgentEvent, IMonologueLLM, MonologueConfig } from "./types.js";

/**
 * Model name mapping for Claude models.
 */
const MODEL_MAP = {
	haiku: "claude-3-5-haiku-latest",
	sonnet: "claude-sonnet-4-20250514",
	opus: "claude-opus-4-20250514",
} as const;

/**
 * Production IMonologueLLM implementation using Claude Agent SDK.
 *
 * Features:
 * - Uses Haiku by default for fast, cheap narratives
 * - Works with Claude Code subscription (no API key needed)
 * - Handles wait signal ("...") as a valid response
 */
@injectable()
export class AnthropicMonologueLLM implements IMonologueLLM {
	private timeout: number;

	constructor(timeout = 5000) {
		this.timeout = timeout;
	}

	async generate(
		events: AgentEvent[],
		history: string[],
		config: MonologueConfig,
		isFirst: boolean,
		isFinal: boolean,
	): Promise<string> {
		const systemPrompt = config.systemPrompt ?? DEFAULT_MONOLOGUE_PROMPT;
		const userMessage = this.formatUserMessage(events, history, isFirst, isFinal);

		try {
			const response = await Promise.race([
				this.executeQuery(systemPrompt, userMessage, config),
				this.createTimeoutPromise(),
			]);

			if (!response) {
				return "..."; // Timeout - treat as wait signal
			}

			return response.trim();
		} catch (_error) {
			// Narratives shouldn't block execution - empty string signals failure
			return "";
		}
	}

	/**
	 * Execute the query using the Claude Agent SDK.
	 */
	private async executeQuery(systemPrompt: string, userMessage: string, config: MonologueConfig): Promise<string> {
		const fullPrompt = `${systemPrompt}\n\n${userMessage}`;
		let result = "";

		// Use the Claude Agent SDK's query function
		for await (const message of query({
			prompt: fullPrompt,
			options: {
				model: MODEL_MAP[config.model],
				maxTurns: 1, // Single turn for simple completion
			},
		})) {
			// Extract text from the message
			if (message.type === "assistant" && message.message?.content) {
				for (const block of message.message.content) {
					if (block.type === "text") {
						result += block.text;
					}
				}
			}
		}

		return result || "...";
	}

	/**
	 * Format the user message with events and context.
	 */
	private formatUserMessage(events: AgentEvent[], history: string[], isFirst: boolean, isFinal: boolean): string {
		const parts: string[] = [];

		// Add context flags
		if (isFirst) {
			parts.push("CONTEXT: This is the FIRST event. Always introduce what you're starting.\n");
		}
		if (isFinal) {
			parts.push("CONTEXT: This is the FINAL flush. Summarize what was accomplished.\n");
		}

		// Add history if available
		if (history.length > 0) {
			parts.push("PREVIOUS NARRATIVES:");
			for (let i = 0; i < history.length; i++) {
				parts.push(`${i + 1}. ${history[i]}`);
			}
			parts.push("");
		}

		// Add events
		parts.push("RECENT EVENTS:");
		for (const event of events) {
			parts.push(this.formatEvent(event));
		}

		return parts.join("\n");
	}

	/**
	 * Format a single event for the LLM.
	 */
	private formatEvent(event: AgentEvent): string {
		const { event_type, payload } = event;

		switch (payload.type) {
			case "tool_call":
				return `[${event_type}] Calling ${payload.tool_name}`;
			case "tool_result":
				if (payload.error) {
					return `[${event_type}] ${payload.tool_name} failed: ${payload.error}`;
				}
				return `[${event_type}] ${payload.tool_name} returned result`;
			case "text":
				return `[${event_type}] Agent: ${this.truncate(payload.content, 100)}`;
			case "thinking":
				return `[${event_type}] Thinking: ${this.truncate(payload.content, 80)}`;
			case "completion":
				return payload.summary ? `[${event_type}] Completed: ${payload.summary}` : `[${event_type}] Completed`;
			default:
				return `[${event_type}] Unknown event`;
		}
	}

	private truncate(text: string, maxLen: number): string {
		if (text.length <= maxLen) return text;
		return `${text.slice(0, maxLen)}...`;
	}

	private createTimeoutPromise(): Promise<null> {
		return new Promise((resolve) => {
			setTimeout(() => resolve(null), this.timeout);
		});
	}
}
