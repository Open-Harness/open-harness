/**
 * Validation Results Channel
 *
 * Focused channel that handles validation-specific events.
 * Composes with ConsoleChannel for standard workflow events.
 */

import { defineChannel } from "@openharness/sdk";

/**
 * Validation Results Channel - displays code execution results.
 *
 * This channel demonstrates:
 * - Focused responsibility (only validation results)
 * - Beautiful formatting with box-drawing characters
 * - Channel composition pattern
 * - ~30 lines vs 120+ if duplicating ConsoleChannel
 */
export const ValidationResultsChannel = defineChannel({
	name: "ValidationResults",

	// Minimal state - just track validation result
	state: () => ({
		validationPassed: false,
	}),

	// Event handlers
	on: {
		// Custom validation result event
		"validation:result": ({ event, output, state }) => {
			const data = event.event as any;
			state.validationPassed = data.passed;

			output.newline();
			output.line("┌─ Validation Results");

			if (data.passed) {
				output.success("│  ✓ Execution successful!");
				if (data.output) {
					output.line("│  Output:");
					const lines = data.output.split("\n");
					for (const line of lines) {
						if (line.trim()) {
							output.line(`│    ${line}`);
						}
					}
				}
			} else {
				output.fail("│  ✗ Execution failed!");
				if (data.error) {
					output.line("│  Error:");
					const lines = data.error.split("\n");
					for (const line of lines) {
						if (line.trim()) {
							output.line(`│    ${line}`);
						}
					}
				}
				if (data.exitCode !== undefined) {
					output.line(`│  Exit code: ${data.exitCode}`);
				}
			}

			output.line("└─");
		},
	},

	// Final status on completion
	onComplete: ({ output, state }) => {
		output.newline();
		if (state.validationPassed) {
			output.success("✅ All validations passed");
		} else {
			output.fail("❌ Validation failed");
		}
	},
});
