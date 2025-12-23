/**
 * Harvest - Captures golden recordings for replay testing
 */

import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { inject, injectable } from "@needle-di/core";
import { createContainer } from "../src/core/container.js";
import { Record } from "../src/core/decorators.js";
import { type IAgentRunner, IAgentRunnerToken, type RunnerCallbacks } from "../src/core/tokens.js";

@injectable()
class Harvester {
	constructor(private runner: IAgentRunner = inject(IAgentRunnerToken)) {}

	@Record("golden", (args) => args[1] as string)
	async capture(
		prompt: string,
		scenarioId: string,
		options?: Options,
		callbacks?: RunnerCallbacks,
	): Promise<SDKMessage | undefined> {
		console.log(`Capturing Scenario: ${scenarioId}...`);

		return this.runner.run({
			prompt,
			options: {
				model: "sonnet",
				maxThinkingTokens: options?.maxThinkingTokens ?? 4000,
				permissionMode: "bypassPermissions",
				...options,
			},
			callbacks,
		});
	}
}

function generateBloat(tokens: number): string {
	// Roughly 4 characters per token
	const chars = tokens * 4;
	let bloat = "\n\n--- PADDING START ---\n";
	const pattern = "This is padding text to increase context size. ";
	while (bloat.length < chars) {
		bloat += pattern;
	}
	bloat += "\n--- PADDING END ---\n\n";
	return bloat;
}

async function runHarvest() {
	// Create container in live mode (not replay)
	const container = createContainer({ mode: "live" });

	// Bind the Harvester
	container.bind(Harvester);

	const harvester = container.get(Harvester);
	const resumeId = process.env.RESUME_ID;
	const harvestCwd = process.env.HARVEST_CWD;
	const bloatTokens = parseInt(process.env.BLOAT_TOKENS || "0", 10);

	if (resumeId) {
		console.log(`RESUME_ID detected: ${resumeId}.`);
		let prompt =
			"I'm attaching to this session to observe your current state. Please provide a brief summary of what you've done so far in this chat.";

		if (bloatTokens > 0) {
			console.log(`Adding ${bloatTokens} tokens of bloat to the prompt...`);
			prompt = `${generateBloat(bloatTokens)}\n\n${prompt}`;
		}

		await harvester.capture(
			prompt,
			"SCN_CONTEXT_RECOVERY",
			{
				resume: resumeId,
				cwd: harvestCwd,
				maxThinkingTokens: 20000,
			},
			{
				onMessage: (msg) => {
					if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
						for (const block of msg.message.content) {
							if (block.type === "text") {
								process.stdout.write(block.text);
							}
						}
					}
				},
			},
		);

		console.log(`\nFinished capturing session as SCN_CONTEXT_RECOVERY\n`);
		return;
	}

	const scenarios = [
		{
			id: "SCN_SUCCESS_CODE",
			prompt:
				"Create a file named 'math_utils.py' with a function that calculates the nth prime number. Use the Bash tool to verify it with a small test script.",
		},
		{
			id: "SCN_CONTEXT_EXHAUSTION",
			prompt:
				"I want you to do a very complex task involving multiple files. Start by creating a directory 'complex_app', then create 5 different python files in it with placeholder logic. (Note: I will simulate exhaustion by limiting your turns later, but for now just do this initial setup).",
		},
		{
			id: "SCN_FAILED_TASK",
			prompt:
				"Open the file 'ghost_config.json' which does not exist and try to append a new key 'debug': true to it. Do not create the file if it doesn't exist, just try to edit it and tell me what happens.",
		},
	];

	for (const scn of scenarios) {
		await harvester.capture(
			scn.prompt,
			scn.id,
			{ cwd: harvestCwd },
			{
				onMessage: (msg) => {
					if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
						for (const block of msg.message.content) {
							if (block.type === "text") {
								process.stdout.write(block.text);
							}
						}
					}
				},
			},
		);
		console.log(`\nFinished ${scn.id}\n---\n`);
	}
}

runHarvest().catch(console.error);
