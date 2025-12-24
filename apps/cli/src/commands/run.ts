/**
 * Run Command - Execute a workflow from YAML configuration
 */

import chalk from "chalk";
import { loadWorkflowConfig } from "../config/loader.js";
import type { ModelName } from "../schemas/workflow.js";
import { executeAutonomousWorkflow } from "../workflows/autonomous.js";

const VALID_MODELS: readonly ModelName[] = ["sonnet", "haiku", "opus"] as const;

function isValidModel(model: string): model is ModelName {
	return VALID_MODELS.includes(model as ModelName);
}

export interface RunOptions {
	projectDir?: string;
	maxIterations?: number;
	monologue?: boolean;
	model?: string;
}

export async function runCommand(workflowPath: string, options: RunOptions): Promise<void> {
	console.log(chalk.cyan("\n=".repeat(70)));
	console.log(chalk.cyan.bold("  DAO WORKFLOW RUNNER"));
	console.log(chalk.cyan("=".repeat(70)));

	try {
		// Validate model option if provided
		if (options.model && !isValidModel(options.model)) {
			console.error(chalk.red(`\n✗ Invalid model: ${options.model}`));
			console.error(chalk.dim(`  Valid models: ${VALID_MODELS.join(", ")}`));
			process.exit(1);
		}

		// Load and validate workflow config
		console.log(chalk.dim(`\nLoading workflow: ${workflowPath}`));
		const config = await loadWorkflowConfig(workflowPath);

		// Apply CLI overrides
		if (options.projectDir) {
			config.workflow.projectDir = options.projectDir;
		}
		if (options.maxIterations !== undefined) {
			config.workflow.maxIterations = options.maxIterations;
		}
		if (options.model && isValidModel(options.model)) {
			if (config.agents?.initializer) {
				config.agents.initializer.model = options.model;
			}
			if (config.agents?.builder) {
				config.agents.builder.model = options.model;
			}
		}
		if (options.monologue === false && config.agents?.narrator) {
			config.agents.narrator.enabled = false;
		}

		console.log(chalk.green("✓ Configuration loaded"));
		console.log(chalk.dim(`  Name: ${config.workflow.name}`));
		console.log(chalk.dim(`  Type: ${config.workflow.type}`));
		console.log(chalk.dim(`  Project: ${config.workflow.projectDir}`));
		if (config.workflow.maxIterations) {
			console.log(chalk.dim(`  Max iterations: ${config.workflow.maxIterations}`));
		}

		// Execute based on workflow type (explicit type field, not name matching)
		switch (config.workflow.type) {
			case "autonomous-coding":
				await executeAutonomousWorkflow(config);
				break;
			default: {
				// TypeScript exhaustiveness check - this should never happen if schema is valid
				const _exhaustive: never = config.workflow.type;
				console.log(chalk.yellow(`\nUnknown workflow type: ${config.workflow.type}`));
				process.exit(1);
			}
		}
	} catch (error) {
		console.error(chalk.red("\n✗ Error:"), error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
