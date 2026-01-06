/**
 * Lesson 06: Claude Agent Flow Execution
 *
 * Demonstrates using the claude.agent node in a flow for one-shot tasks.
 *
 * Scenario: Generate API documentation from a TypeScript interface.
 *
 * Primitives used:
 * - runFlowFile() - executes a flow from YAML
 * - claude.agent node - LLM-powered processing
 * - Flow YAML bindings - {{ flow.input.code }}
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { consoleChannel } from "../../src/channels/console-channel.js";
import { runFlowFile } from "../../src/flow-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sampleInterface = `
interface UserService {
  /** Creates a new user. Throws ValidationError if email invalid. */
  createUser(email: string, password: string): Promise<User>;

  /** Gets user by ID, returns null if not found. */
  getUser(id: string): Promise<User | null>;

  /** Deletes user permanently. Cannot be undone. */
  deleteUser(id: string): Promise<void>;
}
`;

async function main() {
	console.log("Lesson 06: Claude Agent Flow Execution\n");
	console.log("Scenario: Generate API documentation from TypeScript\n");
	console.log("--- Input ---");
	console.log(sampleInterface);
	console.log("--- End Input ---\n");

	const outputs = await runFlowFile({
		filePath: resolve(__dirname, "flow.yaml"),
		inputOverrides: {
			code: sampleInterface,
			language: "TypeScript",
		},
		attachments: [consoleChannel],
	});

	console.log("\n--- Generated Documentation ---");
	const result = outputs["doc_generator"] as { text?: string } | undefined;
	if (result?.text) {
		console.log(result.text);
		console.log("\n✓ Claude generated documentation successfully");
	} else {
		console.log("No output received from Claude");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
