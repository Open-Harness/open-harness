// Flow Node: control.wait
// Delays execution for a specified duration

import { z } from "zod";
import type {
	NodeTypeDefinition,
	WaitInput,
	WaitOutput,
} from "../../protocol/flow.js";

const WaitInputSchema = z.object({
	ms: z
		.number()
		.int()
		.nonnegative()
		.optional()
		.default(0)
		.describe("Milliseconds to wait"),
	until: z
		.string()
		.optional()
		.describe("Event name to wait for (not yet implemented)"),
});

const WaitOutputSchema = z.object({
	waitedMs: z.number().describe("Actual milliseconds waited"),
});

/**
 * control.wait node type definition.
 *
 * Pauses execution for a specified duration.
 * Useful for rate limiting, timing coordination, or debugging.
 *
 * Example YAML usage:
 * ```yaml
 * nodes:
 *   - id: rate-limit
 *     type: control.wait
 *     input:
 *       ms: 1000
 * ```
 */
export const controlWaitNode: NodeTypeDefinition<WaitInput, WaitOutput> = {
	type: "control.wait",
	inputSchema: WaitInputSchema,
	outputSchema: WaitOutputSchema,
	capabilities: {
		// wait is just a delay - no special capabilities
	},
	metadata: {
		displayName: "Wait",
		description: "Pause execution for specified duration",
		category: "control",
		color: "#f59e0b", // Amber for pause/wait
	},
	run: async (_ctx, input) => {
		const ms = input.ms ?? 0;

		if (ms > 0) {
			const startTime = Date.now();
			await new Promise((resolve) => setTimeout(resolve, ms));
			const actualWait = Date.now() - startTime;
			return { waitedMs: actualWait };
		}

		return { waitedMs: 0 };
	},
};
