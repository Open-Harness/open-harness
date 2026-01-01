/**
 * REAL end-to-end test of OUR code with the REAL Claude SDK
 *
 * Tests: FlowRuntime -> executor -> claude.agent node -> real SDK
 */

import { HubImpl } from "../src/engine/hub.js";
import { executeFlow } from "../src/flow/executor.js";
import { claudePack, corePack } from "../src/flow/packs.js";
import { NodeRegistry } from "../src/flow/registry.js";
import type { FlowYaml } from "../src/protocol/flow.js";

async function main() {
	console.log("Testing OUR FlowRuntime with REAL Claude SDK...\n");

	// Build registry with REAL claude pack
	const registry = new NodeRegistry();
	corePack.register(registry);
	claudePack.register(registry);

	console.log("Registered nodes:", registry.list());

	// Define a simple flow that uses claude.agent
	const flow: FlowYaml = {
		flow: {
			name: "real-claude-flow",
			input: {
				task: "Reply with exactly: Hello from FlowRuntime",
			},
		},
		nodes: [
			{
				id: "claude",
				type: "claude.agent",
				input: {
					prompt: "{{ flow.input.task }}",
				},
			},
		],
		edges: [],
	};

	// Create hub and run
	const hub = new HubImpl("real-test");
	hub.startSession();

	// Subscribe to all events for debugging
	hub.subscribe("*", (event) => {
		console.log(
			`[Event] ${event.type}:`,
			JSON.stringify(event.event).slice(0, 100),
		);
	});

	const phase = async <T>(name: string, fn: () => Promise<T>) => {
		console.log(`\nPhase: ${name}`);
		return fn();
	};

	const task = async <T>(id: string, fn: () => Promise<T>) => {
		console.log(`  Task: ${id} starting...`);
		const start = Date.now();
		try {
			const result = await fn();
			console.log(`  Task: ${id} completed in ${Date.now() - start}ms`);
			return result;
		} catch (err) {
			console.log(`  Task: ${id} FAILED after ${Date.now() - start}ms`);
			throw err;
		}
	};

	hub.setStatus("running");

	console.log("\nExecuting flow...");
	const result = await executeFlow(flow, registry, { hub, phase, task });

	hub.setStatus("complete");

	console.log("\n--- Result ---");
	console.log(JSON.stringify(result.outputs, null, 2));

	const claudeOutput = result.outputs.claude as { text?: string };
	if (claudeOutput?.text) {
		console.log("\n✓ SUCCESS - Claude responded:", claudeOutput.text);
	} else {
		console.log("\n✗ FAILED - No text response from Claude");
	}
}

main().catch((err) => {
	console.error("\nFAILED:", err);
	process.exit(1);
});
