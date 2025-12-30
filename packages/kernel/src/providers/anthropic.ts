// Provider: Anthropic (Claude Code SDK)
// Implements docs/implementation/roadmap.md Milestone 6

import { unstable_v2_prompt } from "@anthropic-ai/claude-agent-sdk";
import type {
	AgentDefinition,
	AgentExecuteContext,
} from "../protocol/agent.js";

export interface AnthropicTextInput {
	prompt: string;
	model?: string;
}

export interface AnthropicTextOutput {
	text: string;
}

export interface AnthropicTextAdapterOptions {
	model?: string;
	replay?: Record<string, string>;
}

export function createAnthropicTextAgent(
	options: AnthropicTextAdapterOptions = {},
): AgentDefinition<AnthropicTextInput, AnthropicTextOutput> {
	return {
		name: "anthropic.text",
		async execute(
			input: AnthropicTextInput,
			_ctx: AgentExecuteContext,
		): Promise<AnthropicTextOutput> {
			const replay = options.replay?.[input.prompt];
			if (replay !== undefined) {
				return { text: replay };
			}

			const model = input.model ?? options.model ?? "sonnet";
			const result = await unstable_v2_prompt(input.prompt, { model });

			if (result.type === "result" && result.subtype === "success") {
				return { text: result.result };
			}

			if (result.type === "result" && "errors" in result) {
				throw new Error(result.errors.join("; "));
			}

			throw new Error("Anthropic request failed");
		},
	};
}
