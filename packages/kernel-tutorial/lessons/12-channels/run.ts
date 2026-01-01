/**
 * Lesson 12: Channels (Attachments)
 *
 * Demonstrates the Attachment pattern for observing Hub events.
 *
 * Scenario: Multiple channels observe task completion events -
 * a console logger and a custom metrics collector.
 *
 * Primitives used:
 * - Attachment type - function that receives Hub, returns cleanup
 * - hub.subscribe() - listen for specific event types
 * - runFlow() with attachments - wire channels to flow execution
 *
 * Channels/Attachments are the observer pattern for the event bus:
 * - Subscribe to events you care about
 * - Perform side effects (logging, metrics, notifications)
 * - Return cleanup function for resource management
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Attachment } from "@open-harness/kernel";
import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Custom metrics channel that counts task completions.
 * This demonstrates the Attachment pattern:
 * 1. Receive Hub reference
 * 2. Subscribe to events
 * 3. Return cleanup function
 */
const metricsChannel: Attachment = (hub) => {
	let tasksCompleted = 0;
	let tasksFailed = 0;

	// Subscribe to task events
	const unsubComplete = hub.subscribe("task:complete", () => {
		tasksCompleted += 1;
	});

	const unsubFailed = hub.subscribe("task:failed", () => {
		tasksFailed += 1;
	});

	// Return cleanup function
	return () => {
		unsubComplete();
		unsubFailed();
		console.log("\n📈 Metrics Summary:");
		console.log(`   Tasks completed: ${tasksCompleted}`);
		console.log(`   Tasks failed: ${tasksFailed}`);
	};
};

async function main() {
	console.log("Lesson 12: Channels (Attachments)\n");
	console.log("Scenario: Console logger + metrics collector observe events\n");

	// Run flow with multiple attachments
	const outputs = await runFlowFile({
		filePath: resolve(__dirname, "flow.yaml"),
		attachments: [consoleChannel, metricsChannel],
	});

	console.log("\n--- Flow Outputs ---");
	const first = outputs["first"] as { value?: { text?: string } } | undefined;
	const second = outputs["second"] as { value?: { text?: string } } | undefined;

	console.log(`First: ${first?.value?.text ?? "(no output)"}`);
	console.log(`Second: ${second?.value?.text ?? "(no output)"}`);

	// Verify
	if (first?.value?.text && second?.value?.text) {
		console.log("\n✓ Flow executed with multiple channels");
	} else {
		console.error("\n✗ Flow execution failed");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
