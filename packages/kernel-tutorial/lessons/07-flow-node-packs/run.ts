/**
 * Lesson 07: Node Packs
 *
 * Demonstrates how node packs provide modular collections of node types
 * that can be combined in flows.
 *
 * Scenario: A data processing pipeline that uses nodes from multiple packs:
 * - Core pack: constant, condition.equals, echo (built-in utilities)
 * - Tutorial pack: tutorial.uppercase, tutorial.delay (custom transforms)
 *
 * Key concept: Flows declare which packs they need via nodePacks: [core, tutorial]
 * This allows different projects to have different node capabilities.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
	console.log("Lesson 07: Node Packs\n");
	console.log("Scenario: Multi-pack data processing pipeline\n");
	console.log("Available packs and their nodes:");
	console.log("  Core pack:");
	console.log("    • constant    - Static configuration values");
	console.log("    • condition   - Conditional logic");
	console.log("    • echo        - Text output");
	console.log("  Tutorial pack:");
	console.log("    • uppercase   - Text transformation");
	console.log("    • delay       - Processing simulation\n");

	const outputs = await runFlowFile({
		filePath: resolve(__dirname, "flow.yaml"),
		attachments: [consoleChannel],
	});

	console.log("\n--- Pipeline Results ---\n");

	// Show how each pack contributed
	const config = outputs["config"] as { value: { prefix: string; timestamp: string } };
	const transform = outputs["transform"] as { text: string };
	const delay = outputs["simulate_processing"] as { waitedMs: number };
	const final = outputs["final_output"] as { text: string };

	console.log("Core pack contributions:");
	console.log(`  • constant: Provided prefix "${config.value.prefix}"`);
	console.log(`  • echo: Produced final output`);

	console.log("\nTutorial pack contributions:");
	console.log(`  • uppercase: Transformed to "${transform.text}"`);
	console.log(`  • delay: Simulated ${delay.waitedMs}ms processing time`);

	console.log(`\nFinal output: ${final.text}`);

	console.log("\n✓ Multiple node packs working together successfully");
	console.log("✓ Each pack provides specialized capabilities");
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
