#!/usr/bin/env bun

/**
 * Autonomous Coding Agent - Main Entry Point
 *
 * Recreates Anthropic's 24-hour autonomous agent pattern in TypeScript
 * using the bun-vi SDK.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createBuilderAgent } from "./src/agents/builder.js";
import { createInitializerAgent } from "./src/agents/initializer.js";
import {
	copyAppSpecToProject,
	featureListExists,
	getProgressStats,
	printProgressSummary,
	updateProgressNotes,
} from "./src/utils.js";

// ============================================
// Configuration
// ============================================

const AUTO_CONTINUE_DELAY_MS = 3000;
const DEFAULT_MODEL = "sonnet";

// ============================================
// CLI Argument Parsing
// ============================================

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		"project-dir": {
			type: "string",
			default: "./autonomous_demo_project",
		},
		"max-iterations": {
			type: "string",
		},
		model: {
			type: "string",
			default: DEFAULT_MODEL,
		},
		"enable-monologue": {
			type: "boolean",
			default: true,
		},
	},
	strict: false,
	allowPositionals: true,
});

const projectDir = typeof values["project-dir"] === "string" ? values["project-dir"] : "./autonomous_demo_project";
const maxIterations = typeof values["max-iterations"] === "string" ? parseInt(values["max-iterations"], 10) : undefined;
const model = typeof values.model === "string" ? values.model : DEFAULT_MODEL;
const enableMonologue = typeof values["enable-monologue"] === "boolean" ? values["enable-monologue"] : true;

// ============================================
// Main Execution
// ============================================

async function main() {
	console.log(`\n${"=".repeat(70)}`);
	console.log("  AUTONOMOUS CODING AGENT DEMO");
	console.log("=".repeat(70));
	console.log(`\nProject directory: ${projectDir}`);
	console.log(`Model: ${model}`);
	if (maxIterations) {
		console.log(`Max iterations: ${maxIterations}`);
	} else {
		console.log("Max iterations: Unlimited (will run until completion)");
	}
	console.log(`Monologue: ${enableMonologue ? "Enabled" : "Disabled"}`);
	console.log();

	// Create project directory
	if (!existsSync(projectDir)) {
		await mkdir(projectDir, { recursive: true });
	}

	// Check if this is initialization or continuation
	const isFirstRun = !featureListExists(projectDir);

	if (isFirstRun) {
		console.log("🎬 Fresh start - will use initializer agent");
		console.log();
		console.log("=".repeat(70));
		console.log("  NOTE: First session may take 10-20+ minutes!");
		console.log("  The agent is generating 200 detailed test cases.");
		console.log("  This may appear to hang - it's working.");
		console.log("=".repeat(70));
		console.log();

		// Copy app spec to project directory
		copyAppSpecToProject(projectDir);
	} else {
		console.log("🔄 Continuing existing project");
		printProgressSummary(projectDir);
	}

	// Create agents
	const initializer = createInitializerAgent();
	const builder = createBuilderAgent({
		enableMonologue,
		onNarrative: (text) => {
			console.log(`\n📖 Builder: "${text}"\n`);
		},
	});

	// Main loop
	let iteration = 0;
	let shouldContinue = true;

	while (shouldContinue) {
		iteration++;

		// Check max iterations
		if (maxIterations && iteration > maxIterations) {
			console.log(`\n✋ Reached max iterations (${maxIterations})`);
			console.log("To continue, run the script again without --max-iterations");
			break;
		}

		// Print session header
		console.log(`\n${"=".repeat(70)}`);
		console.log(`  SESSION ${iteration}`);
		console.log("=".repeat(70));
		console.log();

		try {
			if (isFirstRun && iteration === 1) {
				// First session: Initialize
				console.log("🎯 Running initializer agent...\n");

				await initializer.run("Read app_spec.txt and set up the project foundation", `session_init`, {
					permissionMode: "bypassPermissions",
					allowDangerouslySkipPermissions: true,
					callbacks: {
						onText: (content: string) => {
							// Print text output
							process.stdout.write(content);
						},
						onToolCall: (toolName: string) => {
							console.log(`\n[Tool: ${toolName}]`);
						},
						onResult: (result: { num_turns: number; total_cost_usd: number }) => {
							console.log(`\n✅ Session complete`);
							console.log(`Turns: ${result.num_turns}`);
							console.log(`Cost: $${result.total_cost_usd.toFixed(4)}`);
						},
					},
				});

				// Update progress
				updateProgressNotes(
					projectDir,
					iteration,
					"Initialized project with feature_list.json, init.sh, and structure",
				);
			} else {
				// Subsequent sessions: Build
				console.log("🔨 Running builder agent...\n");

				await builder.run("Continue building the application", `session_${iteration}`, {
					permissionMode: "bypassPermissions",
					allowDangerouslySkipPermissions: true,
					callbacks: {
						onText: (content: string) => {
							process.stdout.write(content);
						},
						onToolCall: (toolName: string) => {
							console.log(`\n[Tool: ${toolName}]`);
						},
						onResult: (result: { num_turns: number; total_cost_usd: number }) => {
							console.log(`\n✅ Session complete`);
							console.log(`Turns: ${result.num_turns}`);
							console.log(`Cost: $${result.total_cost_usd.toFixed(4)}`);
						},
					},
				});
			}

			// Check progress
			const stats = getProgressStats(projectDir);

			if (stats.total > 0 && stats.pending === 0) {
				console.log("\n🎉 All features complete!");
				shouldContinue = false;
			} else {
				console.log(`\n⏸️  Agent will auto-continue in ${AUTO_CONTINUE_DELAY_MS / 1000}s...`);
				console.log("   (Press Ctrl+C to pause)");

				printProgressSummary(projectDir);

				await Bun.sleep(AUTO_CONTINUE_DELAY_MS);
			}
		} catch (error) {
			console.error("\n❌ Session error:", error);
			console.log("Will retry with fresh session...");
			await Bun.sleep(AUTO_CONTINUE_DELAY_MS);
		}
	}

	// Final summary
	console.log(`\n${"=".repeat(70)}`);
	console.log("  SESSION COMPLETE");
	console.log("=".repeat(70));
	console.log(`\nProject directory: ${projectDir}`);
	printProgressSummary(projectDir);

	console.log(`\n${"-".repeat(70)}`);
	console.log("  TO RUN THE GENERATED APPLICATION:");
	console.log("-".repeat(70));
	console.log(`\n  cd ${projectDir}`);
	console.log("  ./init.sh           # Run the setup script");
	console.log("  # Or manually:");
	console.log("  bun install && bun run dev");
	console.log("\n  Then open http://localhost:3000");
	console.log("-".repeat(70));

	console.log("\n✨ Done!\n");
}

// Run
main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
