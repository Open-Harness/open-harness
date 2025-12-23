/**
 * Config Loader - Load and validate YAML workflow configurations
 */

import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { type WorkflowConfig, WorkflowConfigSchema } from "../schemas/workflow.js";

/**
 * Load and validate a workflow configuration from a YAML file
 */
export async function loadWorkflowConfig(filePath: string): Promise<WorkflowConfig> {
	// Check file exists
	if (!existsSync(filePath)) {
		throw new Error(`Workflow file not found: ${filePath}`);
	}

	// Read file
	const content = readFileSync(filePath, "utf-8");

	// Parse YAML
	let parsed: unknown;
	try {
		parsed = parse(content);
	} catch (error) {
		throw new Error(`Invalid YAML: ${error instanceof Error ? error.message : error}`);
	}

	// Validate against schema
	const result = WorkflowConfigSchema.safeParse(parsed);
	if (!result.success) {
		const errors = result.error.errors.map((e) => `  - ${e.path.join(".")}: ${e.message}`).join("\n");
		throw new Error(`Invalid workflow configuration:\n${errors}`);
	}

	return result.data;
}

/**
 * Load custom prompt file if specified
 */
export function loadPromptFile(promptPath: string | undefined, defaultPrompt: string): string {
	if (!promptPath) {
		return defaultPrompt;
	}

	if (!existsSync(promptPath)) {
		throw new Error(`Prompt file not found: ${promptPath}`);
	}

	return readFileSync(promptPath, "utf-8");
}
