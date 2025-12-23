/**
 * Example: Basic Agent Usage
 *
 * Shows the simplest way to use the SDK:
 * - Create an agent with one line
 * - Run it with callbacks
 * - No container exposure
 */

import { createAgent } from "../index.js";

async function runBasicExample() {
	console.log("Basic Agent Example\n");

	// Create a built-in agent - NO container needed!
	const agent = createAgent("coder", {
		model: "haiku",
	});

	console.log("Running agent...\n");

	await agent.run("Write a haiku about dependency injection", "example_session", {
		maxTurns: 1,
		callbacks: {
			onSessionStart: (metadata) => {
				console.log(`Session started (${metadata.model})`);
			},

			onText: (content) => {
				console.log(`Text: ${content}`);
			},

			onResult: (result) => {
				console.log(`\nResult:`);
				console.log(`  Success: ${result.success}`);
				console.log(`  Turns: ${result.num_turns}`);
				console.log(`  Cost: $${result.total_cost_usd.toFixed(4)}`);
				console.log(`  Tokens: ${result.usage.input_tokens} in, ${result.usage.output_tokens} out`);
			},

			onSessionEnd: (message, isError) => {
				const status = isError ? "ERROR" : "OK";
				console.log(`\n[${status}] ${message}`);
			},
		},
	});
}

if (import.meta.main) {
	runBasicExample().catch(console.error);
}

export { runBasicExample };
