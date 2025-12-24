/**
 * Init Command - Interactive workflow configuration generator
 */

import { writeFileSync } from "node:fs";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { stringify } from "yaml";
import type { WorkflowConfig } from "../schemas/workflow.js";

export interface InitOptions {
	template?: string;
	output?: string;
}

export async function initCommand(options: InitOptions): Promise<void> {
	console.log();
	p.intro(chalk.cyan.bold("DAO Workflow Configuration Generator"));

	// Check for template shortcut
	if (options.template === "autonomous-coding") {
		const config = getAutonomousTemplate();
		const outputPath = options.output || "workflow.yaml";
		writeFileSync(outputPath, stringify(config));
		p.outro(chalk.green(`✓ Created ${outputPath} from template`));
		return;
	}

	// Interactive configuration
	const workflow = await p.group(
		{
			name: () =>
				p.text({
					message: "Workflow name",
					placeholder: "autonomous-coding",
					defaultValue: "autonomous-coding",
				}),
			projectDir: () =>
				p.text({
					message: "Project directory",
					placeholder: "./my_project",
					defaultValue: "./my_project",
				}),
			maxIterations: () =>
				p.text({
					message: "Max iterations (leave empty for unlimited)",
					placeholder: "",
				}),
			autoContinueDelay: () =>
				p.text({
					message: "Auto-continue delay (ms)",
					placeholder: "3000",
					defaultValue: "3000",
				}),
		},
		{
			onCancel: () => {
				p.cancel("Configuration cancelled");
				process.exit(0);
			},
		},
	);

	const agents = await p.group(
		{
			initializerModel: () =>
				p.select({
					message: "Initializer agent model",
					options: [
						{ value: "sonnet", label: "Sonnet (recommended)" },
						{ value: "haiku", label: "Haiku (faster, cheaper)" },
						{ value: "opus", label: "Opus (most capable)" },
					],
					initialValue: "sonnet",
				}),
			builderModel: () =>
				p.select({
					message: "Builder agent model",
					options: [
						{ value: "haiku", label: "Haiku (recommended)" },
						{ value: "sonnet", label: "Sonnet" },
						{ value: "opus", label: "Opus" },
					],
					initialValue: "haiku",
				}),
			enableNarrator: () =>
				p.confirm({
					message: "Enable narrator monologue?",
					initialValue: true,
				}),
		},
		{
			onCancel: () => {
				p.cancel("Configuration cancelled");
				process.exit(0);
			},
		},
	);

	// Build config object
	const config: WorkflowConfig = {
		workflow: {
			name: workflow.name as string,
			type: "autonomous-coding", // Currently only type supported
			projectDir: workflow.projectDir as string,
			maxIterations: workflow.maxIterations ? parseInt(workflow.maxIterations as string, 10) : undefined,
			autoContinueDelay: parseInt(workflow.autoContinueDelay as string, 10),
		},
		agents: {
			initializer: {
				model: agents.initializerModel as "sonnet" | "haiku" | "opus",
				permissions: {
					mode: "bypassPermissions",
					allowDangerous: true,
				},
			},
			builder: {
				model: agents.builderModel as "sonnet" | "haiku" | "opus",
				permissions: {
					mode: "bypassPermissions",
					allowDangerous: true,
				},
			},
			narrator: {
				enabled: agents.enableNarrator as boolean,
				bufferSize: 15,
			},
		},
		dataSources: [
			{
				name: "features",
				type: "json-file",
				path: "./feature_list.json",
			},
		],
		execution: {
			workOn: "features",
			strategy: "sequential",
		},
	};

	// Write output
	const outputPath = options.output || "workflow.yaml";

	try {
		const yamlContent = stringify(config);
		writeFileSync(outputPath, yamlContent);
	} catch (error) {
		p.cancel(chalk.red("Failed to write configuration file"));
		console.error(chalk.red(`  Error: ${error instanceof Error ? error.message : error}`));
		process.exit(1);
	}

	p.outro(chalk.green(`✓ Created ${outputPath}`));
	console.log(chalk.dim("\nRun your workflow with:"));
	console.log(chalk.cyan(`  dao run ${outputPath}`));
}

function getAutonomousTemplate(): WorkflowConfig {
	return {
		workflow: {
			name: "autonomous-coding",
			type: "autonomous-coding",
			projectDir: "./my_project",
			autoContinueDelay: 3000,
		},
		agents: {
			initializer: {
				model: "sonnet",
				permissions: {
					mode: "bypassPermissions",
					allowDangerous: true,
				},
			},
			builder: {
				model: "haiku",
				permissions: {
					mode: "bypassPermissions",
					allowDangerous: true,
				},
			},
			narrator: {
				enabled: true,
				bufferSize: 15,
			},
		},
		dataSources: [
			{
				name: "features",
				type: "json-file",
				path: "./feature_list.json",
			},
		],
		execution: {
			workOn: "features",
			strategy: "sequential",
		},
	};
}
