/**
 * Simple Workflow - Minimal example showing channels in action
 *
 * Run: bun packages/sdk/examples/simple-workflow.ts
 */

import { injectable } from "@needle-di/core";
import { defineHarness } from "../src/factory/define-harness.js";
import { clackChannel } from "../../channels/src/clack/index.js";

// ============================================================================
// AGENTS
// ============================================================================

@injectable()
class FileProcessor {
	async process(filename: string): Promise<{ bytes: number }> {
		// Simulate file processing
		await new Promise((r) => setTimeout(r, 800));
		return { bytes: Math.floor(Math.random() * 10000) };
	}
}

@injectable()
class Validator {
	validate(bytes: number): boolean {
		return bytes > 0;
	}
}

// ============================================================================
// WORKFLOW
// ============================================================================

const FileWorkflow = defineHarness({
	name: "file-processor",
	agents: {
		processor: FileProcessor,
		validator: Validator,
	},
	state: (input: { files: string[] }) => ({
		files: input.files,
		results: [] as Array<{ file: string; bytes: number }>,
		totalBytes: 0,
	}),
	run: async ({ agents, state, phase, task }) => {
		// Phase 1: Process Files
		await phase("File Processing", async () => {
			for (const file of state.files) {
				await task(file, async () => {
					const result = await agents.processor.process(file);
					state.results.push({ file, bytes: result.bytes });
					state.totalBytes += result.bytes;
					return result;
				});
			}
		});

		// Phase 2: Validation
		await phase("Validation", async () => {
			await task("validate-results", async () => {
				const valid = agents.validator.validate(state.totalBytes);
				if (!valid) {
					throw new Error("Validation failed: No data processed");
				}
				return { valid, totalBytes: state.totalBytes };
			});
		});

		return {
			filesProcessed: state.results.length,
			totalBytes: state.totalBytes,
		};
	},
});

// ============================================================================
// RUN WORKFLOW
// ============================================================================

async function main() {
	console.log("\n🚀 Starting File Processing Workflow\n");

	const result = await FileWorkflow.create({
		files: ["config.json", "data.csv", "report.pdf", "image.png"],
	})
		.attach(clackChannel({ showTasks: true, showPhases: true }))
		.run();

	console.log("\n✨ Workflow Complete!");
	console.log(`   Files processed: ${result.result.filesProcessed}`);
	console.log(`   Total bytes: ${result.result.totalBytes.toLocaleString()}`);
	console.log(`   Duration: ${result.duration}ms\n`);
}

main().catch((error) => {
	console.error("\n❌ Workflow failed:", error.message);
	process.exit(1);
});
