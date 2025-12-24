/**
 * Example: Recording & Replay Demo
 *
 * Shows how to record an agent session and replay it later for testing.
 */

import { createContainer } from "../core/container.js";
import { IAgentRunnerToken, IVaultToken } from "../core/tokens.js";
import { BaseAgent } from "../runner/base-agent.js";

async function recordSession() {
	console.log("Recording a Session\n");

	const container = createContainer({
		mode: "live",
		config: { recordingsDir: "./recordings" },
	});

	const runner = container.get(IAgentRunnerToken);
	const agent = new BaseAgent("RecordingAgent", runner);

	const prompt = "Explain dependency injection in one sentence";

	await agent.run(prompt, "demo_recording", {
		model: "haiku",
		maxTurns: 1,
		callbacks: {
			onSessionStart: (metadata) => {
				console.log(`Session started (${metadata.model})`);
			},
			onText: (content) => {
				console.log(`Text: ${content}`);
			},
			onSessionEnd: (message) => {
				console.log(`\nSession ended: ${message}`);
			},
		},
	});

	console.log("\nNote: Use @Record decorator to capture sessions for replay");
}

async function replaySession() {
	console.log("\nReplaying a Session\n");

	const container = createContainer({
		mode: "replay",
		config: { recordingsDir: "./recordings" },
	});

	const vault = container.get(IVaultToken);
	const session = await vault.startSession("examples", "demo_recording");

	if (!session.exists()) {
		console.log("No recording found. Run recordSession() first.");
		return;
	}

	// In replay mode, the runner reads from recordings
	// and fires callbacks just like live mode
	const runner = container.get(IAgentRunnerToken);
	const agent = new BaseAgent("ReplayAgent", runner);

	await agent.run("Explain dependency injection in one sentence", "demo_recording", {
		model: "haiku",
		callbacks: {
			onSessionStart: (metadata) => {
				console.log(`[REPLAY] Session started (${metadata.model})`);
			},
			onText: (content) => {
				console.log(`[REPLAY] Text: ${content}`);
			},
			onSessionEnd: (message) => {
				console.log(`[REPLAY] Session ended: ${message}`);
			},
		},
	});
}

async function runRecordingDemo() {
	await recordSession();
	await replaySession();
}

if (import.meta.main) {
	runRecordingDemo().catch(console.error);
}

export { recordSession, replaySession, runRecordingDemo };
