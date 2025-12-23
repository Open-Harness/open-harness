/**
 * LiveSDKRunner - Executes real LLM queries via Claude Agent SDK
 *
 * Consumes the SDK's async generator internally and fires callbacks.
 * Returns a Promise with the final message.
 */

import { type Options, query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { injectable } from "@needle-di/core";
import type { IAgentRunner, RunnerCallbacks } from "./tokens.js";

@injectable()
export class LiveSDKRunner implements IAgentRunner {
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
