/**
 * Validation Workflow Entry Point
 *
 * End-to-end validation example that:
 * - Generates Python code
 * - Writes it to a temp file
 * - Executes and validates output
 * - Cleans up automatically
 *
 * No git operations, no console.log, clean channel composition.
 */

import { ValidationWorkflow } from "./validate-harness.js";
import { ConsoleChannel } from "./console-channel.js";
import { ValidationResultsChannel } from "./validation-channel.js";

async function main() {
	const task = `Generate a Python script that computes and prints fibonacci(10).
The script should define a fibonacci function and print the result.`;

	// Run workflow with channel composition
	const result = await ValidationWorkflow.create({ task })
		.attach(ConsoleChannel) // Standard events (phase, task, narrative)
		.attach(ValidationResultsChannel) // Validation-specific events
		.run();

	// Exit with appropriate code for CI
	process.exit(result.result.passed ? 0 : 1);
}

main().catch((error) => {
	console.error(`Fatal error: ${error.message}`);
	process.exit(1);
});
