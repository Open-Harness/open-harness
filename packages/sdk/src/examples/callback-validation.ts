/**
 * Callback Validation Test
 *
 * Validates that all callback types fire correctly with live SDK.
 */

import { createContainer } from "../core/container.js";
import { IAgentRunnerToken } from "../core/tokens.js";
import { BaseAgent } from "../runner/base-agent.js";

async function validateAllCallbacks() {
	console.log("Callback Validation Test\n");

	const container = createContainer({ mode: "live" });
	const runner = container.get(IAgentRunnerToken);
	const agent = new BaseAgent("ValidationAgent", runner);

	const fired = {
		onSessionStart: false,
		onThinking: false,
		onToolCall: false,
		onToolResult: false,
		onToolProgress: false,
		onText: false,
		onResult: false,
		onSessionEnd: false,
		onError: false,
	};

	console.log("----------------------------------------\n");

	await agent.run("Write a detailed explanation of dependency injection with code examples.", "validation_session", {
		model: "sonnet",
		maxTurns: 2,
		callbacks: {
			onSessionStart: (metadata) => {
				fired.onSessionStart = true;
				console.log(`[OK] onSessionStart (${metadata.model})`);
			},

			onThinking: (thought) => {
				fired.onThinking = true;
				console.log(`[OK] onThinking: ${thought.slice(0, 50)}...`);
			},

			onToolCall: (toolName) => {
				fired.onToolCall = true;
				console.log(`[OK] onToolCall: ${toolName}`);
			},

			onToolResult: () => {
				fired.onToolResult = true;
				console.log(`[OK] onToolResult`);
			},

			onToolProgress: (toolName, elapsed) => {
				fired.onToolProgress = true;
				console.log(`[OK] onToolProgress: ${toolName} (${elapsed}s)`);
			},

			onText: (content) => {
				fired.onText = true;
				console.log(`[OK] onText: ${content.slice(0, 50)}...`);
			},

			onResult: (result) => {
				fired.onResult = true;
				console.log(`[OK] onResult: success=${result.success}`);
			},

			onSessionEnd: (message, isError) => {
				fired.onSessionEnd = true;
				console.log(`[OK] onSessionEnd: ${message} (error=${isError})`);
			},

			onError: (error) => {
				fired.onError = true;
				console.log(`[OK] onError: ${error}`);
			},
		},
	});

	console.log("\n----------------------------------------");
	console.log("\nValidation Results:\n");

	const coreCallbacks = ["onSessionStart", "onText", "onResult", "onSessionEnd"];
	const _optionalCallbacks = ["onThinking", "onToolCall", "onToolResult", "onToolProgress", "onError"];

	let allCoreFired = true;
	for (const [callback, didFire] of Object.entries(fired)) {
		const isCore = coreCallbacks.includes(callback);
		const status = didFire ? "[OK]" : "[--]";
		const label = isCore ? callback : `${callback} (optional)`;
		console.log(`${status} ${label}`);

		if (!didFire && isCore) {
			allCoreFired = false;
		}
	}

	console.log("\n----------------------------------------\n");

	if (allCoreFired) {
		console.log("SUCCESS: All core callbacks fired");
	} else {
		console.log("WARNING: Some core callbacks did not fire");
	}
}

if (import.meta.main) {
	validateAllCallbacks().catch(console.error);
}

export { validateAllCallbacks };
