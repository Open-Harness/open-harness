/**
 * Test to specifically validate onThinking callback
 *
 * Uses a complex reasoning prompt that should trigger extended thinking
 */

import { createContainer } from "../core/container.js";
import { IAgentRunnerToken } from "../core/tokens.js";
import { BaseAgent } from "../runner/base-agent.js";

async function testThinkingCallback() {
	console.log("Testing onThinking Callback\n");

	const container = createContainer({ mode: "live" });
	const runner = container.get(IAgentRunnerToken);
	const agent = new BaseAgent("ThinkingTestAgent", runner);

	let thinkingFired = false;
	let thinkingCount = 0;

	// Prompt with "ultrathink" keyword to trigger extended thinking
	const prompt = `<ultrathink>

Solve this logic puzzle step by step:

Three people - Alice, Bob, and Carol - each have a different pet (cat, dog, fish) and a different favorite color (red, blue, green).

Given these clues:
1. The person who likes red has a dog
2. Alice doesn't like blue
3. Carol has a fish
4. Bob doesn't like green

Who has which pet and likes which color? Show your reasoning.

</ultrathink>`;

	console.log("Running agent with complex reasoning prompt...\n");
	console.log("----------------------------------------\n");

	await agent.run(prompt, "thinking_test", {
		model: "sonnet",
		maxTurns: 1,
		callbacks: {
			onSessionStart: (metadata: Record<string, unknown>) => {
				console.log(`Session started (${metadata.model})\n`);
			},

			onThinking: (thought: string) => {
				thinkingFired = true;
				thinkingCount++;
				console.log(`Thinking block #${thinkingCount}:`);
				console.log(`  ${thought.slice(0, 100)}...\n`);
			},

			onText: (content: string) => {
				console.log(`Response:`);
				console.log(`  ${content.slice(0, 100)}...\n`);
			},

			onSessionEnd: (message: string) => {
				console.log(`${message}\n`);
			},
		},
	});

	console.log("----------------------------------------\n");

	if (thinkingFired) {
		console.log(`SUCCESS: onThinking fired ${thinkingCount} time(s)!`);
		console.log("Extended thinking is working correctly.");
	} else {
		console.log("onThinking did NOT fire");
		console.log("This may indicate:");
		console.log("  1. The model didn't generate thinking blocks for this prompt");
		console.log("  2. Extended thinking might need to be explicitly enabled");
		console.log("  3. The prompt wasn't complex enough to trigger thinking");
	}
}

if (import.meta.main) {
	testThinkingCallback().catch(console.error);
}

export { testThinkingCallback };
