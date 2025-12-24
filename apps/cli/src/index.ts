#!/usr/bin/env bun

/**
 * DAO CLI - Workflow Runner
 *
 * Execute workflows from YAML configurations.
 * Start with autonomous agent support, extensible to other workflow types.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { program } from "commander";
import { initCommand } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { statusCommand } from "./commands/status.js";
import { validateCommand } from "./commands/validate.js";

// ============================================
// CLI Configuration
// ============================================

// Load version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
const VERSION = packageJson.version as string;

program.name("dao").description(chalk.cyan("DAO CLI - Workflow Runner")).version(VERSION);

// ============================================
// Commands
// ============================================

program
	.command("run <workflow>")
	.description("Execute a workflow from a YAML configuration file")
	.option("-p, --project-dir <dir>", "Override project directory")
	.option("-m, --max-iterations <n>", "Maximum iterations to run", (v) => parseInt(v, 10))
	.option("--no-monologue", "Disable narrator monologue")
	.option("--model <model>", "Override agent model (sonnet, haiku, opus)")
	.action(runCommand);

program
	.command("init")
	.description("Interactive workflow configuration generator")
	.option("-t, --template <name>", "Start with a template (autonomous-coding)")
	.option("-o, --output <path>", "Output file path", "workflow.yaml")
	.action(initCommand);

program
	.command("status <project-dir>")
	.description("Show workflow progress status")
	.option("-j, --json", "Output as JSON")
	.action(statusCommand);

program.command("validate <workflow>").description("Validate a workflow configuration file").action(validateCommand);

// ============================================
// Parse and Execute
// ============================================

program.parse();
