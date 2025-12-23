/**
 * Example: All Callback Types
 *
 * Demonstrates every callback type available.
 */

import { createContainer } from "../core/container.js";
import { IAgentRunnerToken } from "../core/tokens.js";
import { BaseAgent } from "../runner/base-agent.js";

async function runCallbackExample() {
	console.log("All Callback Types Example\n");

	const container = createContainer({ mode: "live" });
	const runner = container.get(IAgentRunnerToken);
	const agent = new BaseAgent("CallbackAgent", runner);

	console.log("Running agent with all callbacks...\n");

	await agent.run("Write a haiku about TypeScript type safety", "callback_session", {
		model: "haiku",
		maxTurns: 1,
		callbacks: {
			onSessionStart: (metadata) => {
				console.log(`[SESSION_START] Model: ${metadata.model}`);
			},

			onThinking: (thought) => {
				console.log(`[THINKING] ${thought.slice(0, 60)}...`);
			},

			onText: (content) => {
				console.log(`[TEXT] ${content}`);
			},

			onToolCall: (toolName, input) => {
				console.log(`[TOOL_CALL] ${toolName}`);
				console.log(`  Input: ${JSON.stringify(input).slice(0, 100)}`);
			},

			onToolResult: (result) => {
				console.log(`[TOOL_RESULT] ${JSON.stringify(result).slice(0, 100)}`);
			},

			onToolProgress: (toolName, elapsedSeconds) => {
				console.log(`[TOOL_PROGRESS] ${toolName}: ${elapsedSeconds}s`);
			},

			onResult: (result) => {
				console.log(`[RESULT]`);
				console.log(`  Success: ${result.success}`);
				console.log(`  Duration: ${result.duration_ms}ms`);
				console.log(`  Turns: ${result.num_turns}`);
				console.log(`  Cost: $${result.total_cost_usd.toFixed(4)}`);
				console.log(`  Tokens: ${result.usage.input_tokens} in, ${result.usage.output_tokens} out`);
				if (result.structured_output) {
					console.log(`  Output: ${JSON.stringify(result.structured_output)}`);
				}
			},

			onSessionEnd: (message, isError) => {
				const status = isError ? "ERROR" : "OK";
				console.log(`[SESSION_END] [${status}] ${message}`);
			},

			onError: (error) => {
				console.log(`[ERROR] ${error}`);
			},
		},
	});

	console.log("\nExample complete!");
}

if (import.meta.main) {
	await runCallbackExample();
}

export { runCallbackExample };
