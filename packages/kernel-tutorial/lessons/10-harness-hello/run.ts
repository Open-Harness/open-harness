/**
 * Lesson 10: Agent Execution with Hub
 *
 * Demonstrates running agents directly using Hub as the event bus.
 *
 * Scenario: A simple echo agent that emits text events and returns input.
 *
 * Primitives used:
 * - createHub() - creates the event bus
 * - AgentDefinition - defines agent behavior with execute(input, ctx)
 * - hub.emit() - emit events
 * - Attachments - for console logging (consoleChannel)
 *
 * This lesson shows the direct agent execution pattern without
 * Flow YAML - useful for simple scripts and testing.
 */

import { createHub, type AgentDefinition } from "@open-harness/kernel";
import { consoleChannel } from "../../src/channels/console-channel.js";

/**
 * A simple echo agent that emits the input text as an event.
 */
const EchoAgent: AgentDefinition<{ text: string }, { text: string }> = {
	name: "echo.agent",
	async execute(input, ctx) {
		// Emit a text event so channels can observe it
		ctx.hub.emit({ type: "agent:text", content: input.text, runId: ctx.runId });
		return { text: input.text };
	},
};

async function main() {
	console.log("Lesson 10: Agent Execution with Hub\n");
	console.log("Scenario: Echo agent emits text and returns it\n");

	// Create the Hub - the central event bus
	const hub = createHub("echo-session");
	hub.startSession();

	// Attach the console channel to observe events
	const cleanup = consoleChannel(hub);

	// Generate a unique run ID for this execution
	const runId = `run-${Date.now()}`;

	// Emit lifecycle events (normally done by runtime)
	hub.emit({ type: "harness:start", name: "echo-example" });
	hub.emit({ type: "agent:start", agentName: "echo.agent", runId });

	// Execute the agent
	const result = await EchoAgent.execute(
		{ text: "Hello from direct agent execution!" },
		{ hub, runId },
	);

	// Emit completion event
	hub.emit({ type: "agent:complete", agentName: "echo.agent", success: true, runId });
	hub.emit({ type: "harness:complete", success: true, durationMs: 0 });

	// Cleanup
	if (typeof cleanup === "function") {
		cleanup();
	}

	console.log("\n--- Result ---");
	console.log(`Echo returned: "${result.text}"`);

	// Verify
	if (result.text === "Hello from direct agent execution!") {
		console.log("\n✓ Agent executed successfully via Hub");
	} else {
		console.error("\n✗ Unexpected result");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
