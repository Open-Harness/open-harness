/**
 * Initializer Agent - Sets up project foundation
 *
 * First session: generates feature list, creates init.sh, sets up structure
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAgent } from "../../../../index.js";

/**
 * Create the initializer agent
 */
export function createInitializerAgent() {
	// Load the initializer prompt
	const promptPath = join(import.meta.dir, "../../prompts/initializer.md");
	const prompt = readFileSync(promptPath, "utf-8");

	return createAgent({
		name: "InitializerAgent",
		prompt,
		model: "sonnet",
	});
}
