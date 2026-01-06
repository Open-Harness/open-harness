/**
 * Lesson 14: Programmatic Flow Construction
 *
 * Demonstrates building flows programmatically instead of from YAML.
 *
 * Scenario: Dynamically construct a flow based on runtime conditions,
 * then execute it using the same FlowRuntime.
 *
 * Primitives used:
 * - FlowYaml type - the in-memory flow representation
 * - runFlow() - execute a flow from FlowYaml object
 * - Dynamic node generation - build nodes based on input
 *
 * This is useful when:
 * - Flow structure depends on runtime data
 * - Generating flows from user input
 * - Testing with dynamic node configurations
 */

import type { FlowYaml } from "@open-harness/kernel";
import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlow } from "../../src/flow-runner.js";

/**
 * Build a flow dynamically based on the number of steps.
 */
function buildDynamicFlow(steps: string[]): FlowYaml {
	const nodes = steps.map((step, index) => ({
		id: `step_${index}`,
		type: "constant" as const,
		input: {
			value: { text: step, index },
		},
	}));

	// Create edges to chain nodes sequentially
	const edges = steps.slice(1).map((_, index) => ({
		from: `step_${index}`,
		to: `step_${index + 1}`,
	}));

	return {
		flow: {
			name: "dynamic-flow",
			description: "Programmatically generated flow",
			nodePacks: ["core"],
			input: {},
		},
		nodes,
		edges,
	};
}

async function main() {
	console.log("Lesson 14: Programmatic Flow Construction\n");
	console.log("Scenario: Build and execute a dynamic flow\n");

	// Dynamic input - could come from user, API, database, etc.
	const steps = [
		"Initialize workspace",
		"Fetch dependencies",
		"Run build",
		"Execute tests",
		"Deploy to staging",
	];

	console.log("--- Building Flow ---");
	console.log(`Steps: ${steps.length}`);
	steps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));

	// Build the flow programmatically
	const flow = buildDynamicFlow(steps);

	console.log("\n--- Executing Flow ---\n");

	// Execute using the same runtime as YAML flows
	const outputs = await runFlow({
		flow,
		attachments: [consoleChannel],
	});

	console.log("\n--- Flow Outputs ---");
	for (let i = 0; i < steps.length; i++) {
		const output = outputs[`step_${i}`] as { value?: { text?: string; index?: number } } | undefined;
		console.log(`step_${i}: ${output?.value?.text ?? "(no output)"}`);
	}

	// Verify all steps executed
	const allExecuted = steps.every((_, i) => {
		const output = outputs[`step_${i}`] as { value?: unknown } | undefined;
		return output && typeof output === "object" && output.value;
	});

	if (allExecuted) {
		console.log(`\n✓ All ${steps.length} steps executed successfully`);
	} else {
		console.error("\n✗ Some steps failed");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
