/**
 * Authoritative live test for Anthropic provider adapter.
 *
 * Usage: bun scripts/live/providers/anthropic-live.ts
 */

import { createHub } from "../../../src/engine/hub.js";
import { AgentInboxImpl } from "../../../src/engine/inbox.js";
import { createAnthropicTextAgent } from "../../../src/providers/anthropic.js";

async function runLiveTest() {
	console.log("🧪 Running Anthropic provider live test...");

	const agent = createAnthropicTextAgent();
	const hub = createHub("live-anthropic");
	const inbox = new AgentInboxImpl();

	const output = await agent.execute(
		{ prompt: "Reply with a single word: hello" },
		{ hub, inbox, runId: "run-live-0" },
	);

	if (!output.text || output.text.trim().length === 0) {
		throw new Error("Anthropic provider returned empty output");
	}

	console.log("✅ Anthropic provider live test passed");
}

runLiveTest().catch((error) => {
	console.error("❌ Anthropic provider live test failed:", error);
	process.exit(1);
});
