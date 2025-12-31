/**
 * Lesson 14: Flow ↔ Harness Bridge
 */

import { defineHarness, executeFlow, loadFlowYamlFile } from "@open-harness/kernel";
import { consoleChannel } from "../../src/channels/console-channel.js";
import { buildRegistry, loadNodePacks } from "../../src/flow-runner.js";

async function main() {
	console.log("Lesson 14: Flow ↔ Harness Bridge\n");

	const flow = await loadFlowYamlFile(
		"lessons/14-bridge-flow-harness/flow.yaml",
	);
	const availablePacks = await loadNodePacks();
	const registry = buildRegistry(flow.flow.nodePacks ?? [], availablePacks);

	const Harness = defineHarness<{}, {}, Record<string, unknown>>({
		name: "bridge-flow-harness",
		agents: {},
		state: () => ({}),
		run: async ({ phase, task, hub }) => {
			const result = await executeFlow(flow, registry, { hub, phase, task });
			return result.outputs;
		},
	});

	const harness = Harness.create({});
	harness.attach(consoleChannel);

	const result = await harness.run();
	console.log("\nFlow outputs:", result.result);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
