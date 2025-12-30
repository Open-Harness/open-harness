/**
 * AnthropicRunner - Executes real LLM queries via Claude Agent SDK
 *
 * This is the Anthropic-specific implementation of IAgentRunner.
 * It consumes the SDK's async generator internally and fires callbacks.
 *
 * For other providers (OpenCode, Gemini, etc.), create separate runner
 * implementations that implement the same interface.
 */

import { type Options, query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { injectable } from "@needle-di/core";
import type { IAgentRunner, RunnerCallbacks } from "../../../core/tokens.js";

/**
 * AnthropicRunner - Production runner for Claude/Anthropic API
 *
 * Uses the @anthropic-ai/claude-agent-sdk to execute prompts.
 * Wraps the SDK's async generator pattern in a simpler Promise + callbacks API.
 */
@injectable()
export class AnthropicRunner implements IAgentRunner {
	async run(args: { prompt: string; options: Options; callbacks?: RunnerCallbacks }): Promise<SDKMessage | undefined> {
		const { prompt, options, callbacks } = args;
		let lastMessage: SDKMessage | undefined;

		// Consume the SDK's async generator internally
		for await (const message of query({ prompt, options })) {
			lastMessage = message;

			// Fire callback for each message
			if (callbacks?.onMessage) {
				callbacks.onMessage(message);
			}
		}

		return lastMessage;
	}
}
