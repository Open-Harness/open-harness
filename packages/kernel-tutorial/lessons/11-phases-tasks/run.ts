/**
 * Lesson 11: Phases and Tasks
 *
 * Demonstrates the phases/tasks pattern using FlowRuntime.
 *
 * Scenario: A multi-phase workflow with planning and build phases,
 * each containing discrete tasks.
 *
 * Primitives used:
 * - runFlow() - execute a flow with phases/tasks
 * - FlowYaml structure - define flow with multiple nodes
 * - phase/task events - lifecycle tracking
 * - Attachments - for console logging
 *
 * Phases and tasks provide structure for complex workflows:
 * - Phases: High-level stages (Planning, Build, Deploy)
 * - Tasks: Individual work items within phases
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
	console.log("Lesson 11: Phases and Tasks\n");
	console.log("Scenario: Multi-phase workflow with planning and build\n");

	// The flow.yaml defines nodes that get wrapped in tasks,
	// and the "Run Flow" phase contains all node executions
	const outputs = await runFlowFile({
		filePath: resolve(__dirname, "flow.yaml"),
		attachments: [consoleChannel],
	});

	console.log("\n--- Phase Results ---");
	const plan = outputs["plan"] as { value?: { text?: string } } | undefined;
	const build = outputs["build"] as { value?: { text?: string } } | undefined;

	console.log(`Plan: ${plan?.value?.text ?? "(no output)"}`);
	console.log(`Build: ${build?.value?.text ?? "(no output)"}`);

	// Verify
	if (plan?.value?.text && build?.value?.text) {
		console.log("\n✓ Both phases completed successfully");
	} else {
		console.error("\n✗ Phase execution failed");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
