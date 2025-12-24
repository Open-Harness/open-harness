/**
 * Validate Command - Check workflow configuration
 */

import chalk from "chalk";
import { loadWorkflowConfig } from "../config/loader.js";

export async function validateCommand(workflowPath: string): Promise<void> {
	console.log(chalk.cyan("\nValidating workflow configuration..."));
	console.log(chalk.dim(`File: ${workflowPath}`));

	try {
		const config = await loadWorkflowConfig(workflowPath);

		console.log(chalk.green("\n✓ Configuration is valid"));
		console.log();
		console.log(chalk.dim("Workflow:"));
		console.log(`  Name: ${config.workflow.name}`);
		console.log(`  Project: ${config.workflow.projectDir}`);
		console.log(`  Max iterations: ${config.workflow.maxIterations || "unlimited"}`);
		console.log(`  Auto-continue delay: ${config.workflow.autoContinueDelay}ms`);

		if (config.agents) {
			console.log();
			console.log(chalk.dim("Agents:"));
			if (config.agents.initializer) {
				console.log(`  Initializer: ${config.agents.initializer.model}`);
			}
			if (config.agents.builder) {
				console.log(`  Builder: ${config.agents.builder.model}`);
			}
			if (config.agents.narrator) {
				console.log(`  Narrator: ${config.agents.narrator.enabled ? "enabled" : "disabled"}`);
			}
		}

		if (config.dataSources && config.dataSources.length > 0) {
			console.log();
			console.log(chalk.dim("Data Sources:"));
			for (const ds of config.dataSources) {
				console.log(`  ${ds.name}: ${ds.type} (${ds.path})`);
			}
		}

		if (config.execution) {
			console.log();
			console.log(chalk.dim("Execution:"));
			console.log(`  Work on: ${config.execution.workOn}`);
			console.log(`  Strategy: ${config.execution.strategy}`);
		}

		console.log();
	} catch (error) {
		console.error(chalk.red("\n✗ Validation failed:"), error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
