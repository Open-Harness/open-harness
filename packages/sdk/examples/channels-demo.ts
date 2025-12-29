/**
 * Channel Demo - Demonstrates console and clack channels
 *
 * Shows how to:
 * - Use defineChannel pattern
 * - Attach multiple channels to a harness
 * - Handle events with state management
 * - Create beautiful terminal UI
 *
 * Run: bun packages/sdk/examples/channels-demo.ts
 */

import { injectable } from "@needle-di/core";
import { defineHarness } from "../src/factory/define-harness.js";
import { consoleChannel } from "../../channels/src/console/index.js";
import { clackChannel } from "../../channels/src/clack/index.js";

// ============================================================================
// MOCK AGENTS
// ============================================================================

@injectable()
class DataProcessor {
	async execute(data: string[]): Promise<{ processed: number }> {
		// Simulate async work
		await new Promise((r) => setTimeout(r, 500));
		return { processed: data.length };
	}
}

@injectable()
class Validator {
	execute(count: number): boolean {
		return count > 0;
	}
}

// ============================================================================
// DEMO HARNESS
// ============================================================================

const DemoHarness = defineHarness({
	name: "channels-demo",
	agents: {
		processor: DataProcessor,
		validator: Validator,
	},
	state: (input: { items: string[] }) => ({
		items: input.items,
		processed: 0,
		validated: false,
	}),
	run: async ({ agents, state, phase, task }) => {
		await phase("Data Processing", async () => {
			await task("load-data", async () => {
				// Simulate loading
				await new Promise((r) => setTimeout(r, 300));
				return { loaded: state.items.length };
			});

			await task("process-data", async () => {
				const result = await agents.processor.execute(state.items);
				state.processed = result.processed;
				return result;
			});
		});

		await phase("Validation", async () => {
			await task("validate-results", async () => {
				state.validated = agents.validator.execute(state.processed);
				return { valid: state.validated };
			});
		});

		return {
			success: state.validated,
			itemsProcessed: state.processed,
		};
	},
});

// ============================================================================
// DEMO EXECUTION
// ============================================================================

async function runWithConsoleChannel() {
	console.log("\n🔹 Running with Console Channel:\n");

	const result = await DemoHarness.create({
		items: ["item-1", "item-2", "item-3", "item-4", "item-5"],
	})
		.attach(consoleChannel({ colors: true, timestamps: true, verbosity: "normal" }))
		.run();

	console.log("\n📊 Result:", result.result);
}

async function runWithClackChannel() {
	console.log("\n🔹 Running with Clack Channel:\n");

	const result = await DemoHarness.create({
		items: ["alpha", "beta", "gamma", "delta", "epsilon"],
	})
		.attach(clackChannel({ showTasks: true, showPhases: true }))
		.run();

	console.log("\n📊 Result:", result.result);
}

async function runWithBothChannels() {
	console.log("\n🔹 Running with BOTH Channels (Console + Clack):\n");

	const result = await DemoHarness.create({
		items: ["one", "two", "three"],
	})
		.attach(consoleChannel({ colors: true, timestamps: false, verbosity: "minimal" }))
		.attach(clackChannel({ showTasks: true, showPhases: true }))
		.run();

	console.log("\n📊 Result:", result.result);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log("═══════════════════════════════════════════════════");
	console.log("  OpenHarness Channel Demo");
	console.log("═══════════════════════════════════════════════════\n");

	await runWithConsoleChannel();
	console.log("\n" + "─".repeat(50) + "\n");

	await runWithClackChannel();
	console.log("\n" + "─".repeat(50) + "\n");

	await runWithBothChannels();
	console.log("\n═══════════════════════════════════════════════════");
}

main().catch(console.error);
