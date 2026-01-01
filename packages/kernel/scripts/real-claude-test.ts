/**
 * REAL Claude SDK test - no mocks, no bullshit
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
	console.log("Testing REAL Claude SDK...\n");

	const stream = query({
		prompt: "Say 'Hello from the real Claude SDK!' and nothing else.",
		options: {
			maxTurns: 1,
		},
	});

	console.log("Streaming response:");
	for await (const message of stream) {
		if (message.type === "assistant") {
			console.log("Assistant:", message.message?.content);
		}
		if (message.type === "result") {
			console.log("\nResult:", message.result);
			console.log("Success:", message.subtype === "success");
		}
	}
}

main().catch((err) => {
	console.error("FAILED:", err.message);
	process.exit(1);
});
