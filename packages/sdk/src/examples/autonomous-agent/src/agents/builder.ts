/**
 * Builder Agent - Implements features incrementally
 *
 * Subsequent sessions: picks up where previous left off, implements next feature
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAgent, withMonologue } from "../../../../index.js";

/**
 * Create the builder agent with monologue enabled
 */
export function createBuilderAgent(options?: { enableMonologue?: boolean; onNarrative?: (text: string) => void }) {
	// Load the builder prompt
	const promptPath = join(import.meta.dir, "../../prompts/builder.md");
	const prompt = readFileSync(promptPath, "utf-8");

	const baseAgent = createAgent({
		name: "BuilderAgent",
		prompt,
		model: "haiku",
	});

	// Optionally wrap with monologue
	if (options?.enableMonologue) {
		return withMonologue(baseAgent, {
			bufferSize: 15,
			onNarrative:
				options.onNarrative ||
				((text) => {
					console.log(`\n📖 Agent: "${text}"\n`);
				}),
		});
	}

	return baseAgent;
}
