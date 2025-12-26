/**
 * Autonomous Workflow - Execute autonomous coding agent workflow
 *
 * Wraps the SDK's autonomous agent pattern with YAML configuration.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createAgent, withMonologue } from "@openharness/sdk";
import chalk from "chalk";
import { loadPromptFile } from "../config/loader.js";
import { JsonFileDataSource } from "../data-sources/json-file.js";
import type { WorkflowConfig } from "../schemas/workflow.js";

// Default prompts (embedded for now, can be extracted later)
const DEFAULT_INITIALIZER_PROMPT = `You are an initializer agent. Your job is to:
1. Read the app_spec.txt in the project directory
2. Create a feature_list.json with 200 detailed test cases
3. Create an init.sh setup script
4. Set up the initial project structure

Each test case should have:
- id: unique identifier (e.g., "F001", "S001" for functional/style)
- category: "functional" or "style"
- description: what to test
- steps: array of step descriptions
- status: "pending"

Focus on comprehensive coverage of the app specification.`;

const DEFAULT_BUILDER_PROMPT = `You are a builder agent. Your job is to:
1. Read feature_list.json to find the next pending feature
2. Implement that feature following best practices
3. Update the feature status to "completed" when done
4. Continue to the next feature

Work methodically through each feature, ensuring quality and testing.`;

/**
 * Execute the autonomous coding workflow
 */
export async function executeAutonomousWorkflow(config: WorkflowConfig): Promise<void> {
	const projectDir = config.workflow.projectDir;
	const maxIterations = config.workflow.maxIterations;
	const autoContinueDelay = config.workflow.autoContinueDelay;

	// Set up graceful shutdown handler
	let isShuttingDown = false;
	const handleShutdown = (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		console.log(chalk.yellow(`\n\n⚠️  Received ${signal}. Shutting down gracefully...`));
		console.log(chalk.dim("  Note: Any in-progress tasks may need manual cleanup."));
		console.log(chalk.dim("  Run 'dao status <project-dir>' to check task states.\n"));
		process.exit(0);
	};

	process.on("SIGINT", () => handleShutdown("SIGINT"));
	process.on("SIGTERM", () => handleShutdown("SIGTERM"));

	// Create project directory if needed
	if (!existsSync(projectDir)) {
		await mkdir(projectDir, { recursive: true });
		console.log(chalk.dim(`Created project directory: ${projectDir}`));
	}

	// Check if this is first run (no feature_list.json)
	const dataSource = new JsonFileDataSource(join(projectDir, "feature_list.json"));
	const isFirstRun = !dataSource.exists();

	// Load prompts
	const initializerPrompt = loadPromptFile(config.agents?.initializer?.prompt, DEFAULT_INITIALIZER_PROMPT);
	const builderPrompt = loadPromptFile(config.agents?.builder?.prompt, DEFAULT_BUILDER_PROMPT);

	// Create agents
	const initializerModel = config.agents?.initializer?.model || "sonnet";
	const builderModel = config.agents?.builder?.model || "haiku";
	const narratorEnabled = config.agents?.narrator?.enabled ?? true;
	const narratorBufferSize = config.agents?.narrator?.bufferSize ?? 15;

	const initializerAgent = createAgent({
		name: "InitializerAgent",
		prompt: initializerPrompt,
		model: initializerModel,
	});

	const baseBuilderAgent = createAgent({
		name: "BuilderAgent",
		prompt: builderPrompt,
		model: builderModel,
	});

	// Wrap with monologue if enabled - creates a different type that still has .run()
	const builderAgent = narratorEnabled
		? withMonologue(baseBuilderAgent, {
				bufferSize: narratorBufferSize,
				onNarrative: (text: string) => {
					console.log(chalk.magenta(`\n📖 Builder: "${text}"\n`));
				},
			})
		: baseBuilderAgent;

	// Main execution loop
	let iteration = 0;
	let shouldContinue = true;

	// Phase 1: Initialization (only runs if no feature_list.json exists)
	if (isFirstRun) {
		console.log(chalk.yellow("\n🎬 Fresh start - will use initializer agent"));
		console.log(chalk.dim("  First session may take 10-20+ minutes!"));
		console.log(chalk.dim("  The agent is generating detailed test cases.\n"));

		// Print session header
		console.log(chalk.cyan(`\n${"=".repeat(70)}`));
		console.log(chalk.cyan.bold("  SESSION 1 - INITIALIZATION"));
		console.log(chalk.cyan(`${"=".repeat(70)}\n`));

		console.log(chalk.yellow("🎯 Running initializer agent...\n"));

		try {
			await initializerAgent.run("Read app_spec.txt and set up the project foundation", "session_init", {
				permissionMode: "bypassPermissions",
				allowDangerouslySkipPermissions: true,
				callbacks: {
					onText: (content: string) => {
						process.stdout.write(content);
					},
					onToolCall: (toolName: string) => {
						console.log(chalk.dim(`\n[Tool: ${toolName}]`));
					},
					onResult: (result: { num_turns: number; total_cost_usd: number }) => {
						console.log(chalk.green("\n✓ Initialization complete"));
						console.log(chalk.dim(`  Turns: ${result.num_turns}`));
						console.log(chalk.dim(`  Cost: $${result.total_cost_usd.toFixed(4)}`));
					},
				},
			});
		} catch (error) {
			console.error(chalk.red("\n✗ Initialization error:"), error);
			console.log(chalk.dim("Cannot continue without initialization."));
			return;
		}

		// Start iteration counter at 1 since initialization counts as first session
		iteration = 1;
	} else {
		console.log(chalk.blue("\n🔄 Continuing existing project"));
		const stats = await dataSource.getProgress();
		printProgress(stats);
	}

	// Phase 2: Builder loop (iterates until all features complete or max iterations)
	while (shouldContinue) {
		iteration++;

		// Check max iterations
		if (maxIterations && iteration > maxIterations) {
			console.log(chalk.yellow(`\n✋ Reached max iterations (${maxIterations})`));
			break;
		}

		// Print session header
		console.log(chalk.cyan(`\n${"=".repeat(70)}`));
		console.log(chalk.cyan.bold(`  SESSION ${iteration}`));
		console.log(chalk.cyan(`${"=".repeat(70)}\n`));

		try {
			console.log(chalk.yellow("🔨 Running builder agent...\n"));

			await builderAgent.run("Continue building the application", `session_${iteration}`, {
				permissionMode: "bypassPermissions",
				allowDangerouslySkipPermissions: true,
				callbacks: {
					onText: (content: string) => {
						process.stdout.write(content);
					},
					onToolCall: (toolName: string) => {
						console.log(chalk.dim(`\n[Tool: ${toolName}]`));
					},
					onResult: (result: { num_turns: number; total_cost_usd: number }) => {
						console.log(chalk.green("\n✓ Session complete"));
						console.log(chalk.dim(`  Turns: ${result.num_turns}`));
						console.log(chalk.dim(`  Cost: $${result.total_cost_usd.toFixed(4)}`));
					},
				},
			});

			// Check progress
			const stats = await dataSource.getProgress();

			if (stats.total > 0 && stats.pending === 0 && stats.inProgress === 0) {
				console.log(chalk.green("\n🎉 All features complete!"));
				shouldContinue = false;
			} else {
				console.log(chalk.dim(`\n⏸️  Auto-continuing in ${autoContinueDelay / 1000}s... (Ctrl+C to stop)`));
				printProgress(stats);
				await Bun.sleep(autoContinueDelay);
			}
		} catch (error) {
			console.error(chalk.red("\n✗ Session error:"), error);
			console.log(chalk.dim("Will retry with fresh session..."));
			await Bun.sleep(autoContinueDelay);
		}
	}

	// Final summary
	console.log(chalk.cyan(`\n${"=".repeat(70)}`));
	console.log(chalk.cyan.bold("  WORKFLOW COMPLETE"));
	console.log(chalk.cyan("=".repeat(70)));
	console.log(chalk.dim(`\nProject directory: ${projectDir}`));

	if (dataSource.exists()) {
		const finalStats = await dataSource.getProgress();
		printProgress(finalStats);
	}

	console.log(chalk.dim("\nTo run the generated application:"));
	console.log(chalk.cyan(`  cd ${projectDir}`));
	console.log(chalk.cyan("  ./init.sh"));
	console.log();
}

function printProgress(stats: {
	total: number;
	completed: number;
	failed: number;
	pending: number;
	inProgress: number;
	percentComplete: number;
}): void {
	console.log();
	console.log(chalk.dim(`  Total: ${stats.total}`));
	console.log(chalk.green(`  ✓ Completed: ${stats.completed}`));
	console.log(chalk.red(`  ✗ Failed: ${stats.failed}`));
	console.log(chalk.yellow(`  ⏳ In Progress: ${stats.inProgress}`));
	console.log(chalk.dim(`  ○ Pending: ${stats.pending}`));
	console.log(chalk.cyan(`  📊 Progress: ${stats.percentComplete}%`));
}
