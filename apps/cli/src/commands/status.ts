/**
 * Status Command - Show workflow progress
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { calculateProgress, type TestCaseTask } from "../schemas/task.js";

export interface StatusOptions {
	json?: boolean;
}

export async function statusCommand(projectDir: string, options: StatusOptions): Promise<void> {
	const featureListPath = join(projectDir, "feature_list.json");

	if (!existsSync(featureListPath)) {
		console.error(chalk.red(`\n✗ No feature_list.json found in ${projectDir}`));
		console.log(chalk.dim("  This project may not have been initialized yet."));
		process.exit(1);
	}

	try {
		const content = readFileSync(featureListPath, "utf-8");
		const features = JSON.parse(content) as TestCaseTask[];

		const stats = calculateProgress(features);

		if (options.json) {
			console.log(JSON.stringify(stats, null, 2));
			return;
		}

		// Pretty print progress
		console.log(chalk.cyan(`\n${"=".repeat(50)}`));
		console.log(chalk.cyan.bold("  WORKFLOW PROGRESS"));
		console.log(chalk.cyan("=".repeat(50)));
		console.log();
		console.log(`  ${chalk.dim("Total Features:")}   ${stats.total}`);
		console.log(`  ${chalk.green("✓ Completed:")}     ${stats.completed}`);
		console.log(`  ${chalk.red("✗ Failed:")}        ${stats.failed}`);
		console.log(`  ${chalk.yellow("⏳ In Progress:")}  ${stats.inProgress}`);
		console.log(`  ${chalk.dim("○ Pending:")}       ${stats.pending}`);
		console.log();

		// Progress bar
		const barWidth = 40;
		const filledWidth = Math.round((stats.percentComplete / 100) * barWidth);
		const emptyWidth = barWidth - filledWidth;
		const bar = chalk.green("█".repeat(filledWidth)) + chalk.dim("░".repeat(emptyWidth));
		console.log(`  [${bar}] ${stats.percentComplete}%`);

		console.log(chalk.cyan(`\n${"=".repeat(50)}`));

		// Show next pending task if any
		const nextPending = features.find((f) => f.status === "pending");
		if (nextPending) {
			console.log(chalk.dim("\nNext task:"));
			console.log(`  ${chalk.yellow(nextPending.id)}: ${nextPending.description}`);
		} else if (stats.pending === 0 && stats.inProgress === 0) {
			console.log(chalk.green("\n✓ All tasks complete!"));
		}
	} catch (error) {
		console.error(chalk.red("\n✗ Error reading feature list:"), error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
