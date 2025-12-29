/**
 * Simple Clack Channel Workflow Example
 *
 * Demonstrates the clack channel with a simple workflow that processes
 * a list of items through multiple phases with beautiful terminal UI.
 *
 * Run: bun packages/sdk/examples/clack-simple-workflow.ts
 */

import { injectable } from "@needle-di/core";
import { clackChannel } from "../../channels/src/clack/index.js";
import { defineHarness } from "../src/factory/define-harness.js";

// ============================================================================
// SIMPLE AGENT
// ============================================================================

@injectable()
class ItemProcessor {
	async execute(item: string): Promise<string> {
		// Simulate processing time
		await new Promise((r) => setTimeout(r, 400));
		return item.toUpperCase();
	}
}

// ============================================================================
// SIMPLE WORKFLOW
// ============================================================================

const SimpleWorkflow = defineHarness({
	name: "simple-clack-demo",
	agents: {
		processor: ItemProcessor,
	},
	state: (input: { items: string[] }) => ({
		items: input.items,
		processed: [] as string[],
	}),
	run: async ({ agents, state, phase, task }) => {
		// Phase 1: Setup
		await phase("Setup", async () => {
			await task("initialize", async () => {
				await new Promise((r) => setTimeout(r, 500));
				return { initialized: true };
			});

			await task("load-config", async () => {
				await new Promise((r) => setTimeout(r, 300));
				return { config: "loaded" };
			});
		});

		// Phase 2: Processing
		await phase("Processing", async () => {
			for (const item of state.items) {
				await task(`process-${item}`, async () => {
					const processed = await agents.processor.execute(item);
					state.processed.push(processed);
					return { processed };
				});
			}
		});

		// Phase 3: Finalization
		await phase("Finalization", async () => {
			await task("finalize", async () => {
				await new Promise((r) => setTimeout(r, 200));
				return { finalized: true };
			});
		});

		return {
			totalProcessed: state.processed.length,
			processedItems: state.processed,
		};
	},
});

// ============================================================================
// RUN WORKFLOW
// ============================================================================

async function main() {
	const result = await SimpleWorkflow.create({
		items: ["apple", "banana", "cherry"],
	})
		.attach(clackChannel({ showTasks: true, showPhases: true, showAgents: true }))
		.run();

	console.log("\n📊 Results:");
	console.log(`   Processed ${result.result.totalProcessed} items`);
	console.log(`   Items: ${result.result.processedItems.join(", ")}`);
	console.log(`   Duration: ${result.duration}ms`);
}

main().catch((error) => {
	console.error("\n❌ Error:", error.message);
	process.exit(1);
});
