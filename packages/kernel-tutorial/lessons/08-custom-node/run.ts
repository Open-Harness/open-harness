/**
 * Lesson 08: Custom Node
 *
 * Demonstrates how to create and use custom node types.
 *
 * Scenario: A text analysis pipeline using a custom word_analyzer node.
 * The custom node shows the complete pattern:
 * - Zod input/output schemas for validation
 * - Type-safe run function
 * - Domain-specific processing logic
 *
 * Key pattern: Create a NodeTypeDefinition, register it in a NodeRegistry,
 * then use it in YAML flows like any built-in node.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	NodeRegistry,
	corePack,
	loadFlowYamlFile,
} from "@open-harness/kernel";
import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowRuntime } from "../../src/runtime.js";
import { wordAnalyzerNode } from "./word-analyzer-node.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
	console.log("Lesson 08: Custom Node\n");
	console.log("Scenario: Text analysis with a custom word_analyzer node\n");

	// Show the custom node definition pattern
	console.log("Custom node pattern:");
	console.log("  1. Define input/output schemas with zod");
	console.log("  2. Create NodeTypeDefinition with type, schemas, run function");
	console.log("  3. Register in a NodeRegistry");
	console.log("  4. Use in YAML: type: text.word_analyzer\n");

	// Create a custom registry with core pack + our custom node
	const registry = new NodeRegistry();
	corePack.register(registry);
	registry.register(wordAnalyzerNode);

	// Load and run the flow
	const flow = await loadFlowYamlFile(resolve(__dirname, "flow.yaml"));
	const result = await runFlowRuntime({
		flow,
		registry,
		attachments: [consoleChannel],
	});

	console.log("\n--- Analysis Results ---\n");

	const analysis = result.outputs["analyze"] as {
		words: number;
		characters: number;
		lines: number;
		averageWordLength: number;
		longestWord: string;
	};

	console.log(`Document statistics:`);
	console.log(`  Words:              ${analysis.words}`);
	console.log(`  Characters:         ${analysis.characters}`);
	console.log(`  Lines:              ${analysis.lines}`);
	console.log(`  Avg word length:    ${analysis.averageWordLength}`);
	console.log(`  Longest word:       "${analysis.longestWord}"`);

	console.log("\n✓ Custom node executed successfully");
	console.log("✓ Input/output schemas validated by zod");
	console.log("✓ Node integrated seamlessly with built-in nodes");
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
