/**
 * Authoritative live test for Claude provider adapter.
 *
 * Usage: bun scripts/live/providers/claude-live.ts
 */

import { createHub } from "../../../src/engine/hub.js";
import { AgentInboxImpl } from "../../../src/engine/inbox.js";
import { createClaudeAgent } from "../../../src/providers/claude.js";

async function runLiveTest() {
	console.log("🧪 Running Claude provider live test...");

	const agent = createClaudeAgent();
	const hub = createHub("live-claude");
	const inbox = new AgentInboxImpl();

	const output = await agent.execute(
		{ prompt: "Reply with a single word: hello" },
		{ hub, inbox, runId: "run-live-0" },
	);

	if (!output.text || output.text.trim().length === 0) {
		throw new Error("Claude provider returned empty output");
	}

	console.log("✅ Claude provider live test passed");
}

runLiveTest().catch((error) => {
	console.error("❌ Claude provider live test failed:", error);
	process.exit(1);
});
