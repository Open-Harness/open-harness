// Flow Node: control.fail
// Explicitly fails the flow run with a custom error message

import { z } from "zod";
import type { NodeTypeDefinition } from "../../protocol/flow.js";

/**
 * Input schema for control.fail
 * @see spec.md Appendix A1 - control.fail
 */
const FailInputSchema = z.object({
	message: z.string().describe("Error message describing why the flow failed"),
});

/**
 * Output schema for control.fail
 * Note: This node never returns - it always throws
 */
const FailOutputSchema = z.never();

type FailInput = z.infer<typeof FailInputSchema>;
type FailOutput = z.infer<typeof FailOutputSchema>;

/**
 * Custom error class for flow failures triggered by control.fail
 */
export class FlowFailError extends Error {
	readonly isFlowFailError = true;

	constructor(message: string) {
		super(message);
		this.name = "FlowFailError";
	}
}

/**
 * control.fail node type definition.
 *
 * Explicitly fails the flow run with a custom error message.
 * This is useful for:
 * - Implementing validation logic that should stop the flow
 * - Handling expected error conditions explicitly
 * - Creating "guard" nodes that prevent invalid flow states
 *
 * Example YAML usage:
 * ```yaml
 * nodes:
 *   - id: check-input
 *     type: control.if
 *     input:
 *       condition:
 *         equals:
 *           var: flow.input.required_field
 *           value: null
 *
 *   - id: fail-missing-input
 *     type: control.fail
 *     input:
 *       message: "Required field 'required_field' is missing"
 *
 * edges:
 *   - from: check-input
 *     to: fail-missing-input
 *     when:
 *       equals:
 *         var: check-input.condition
 *         value: true
 * ```
 */
export const controlFailNode: NodeTypeDefinition<FailInput, FailOutput> = {
	type: "control.fail",
	inputSchema: FailInputSchema,
	outputSchema: FailOutputSchema,
	capabilities: {
		// No special capabilities - this node just throws
	},
	metadata: {
		displayName: "Fail",
		description: "Explicitly fail the flow with an error",
		category: "control",
		color: "#ef4444", // Red to indicate danger/error
	},
	run: async (_ctx, input) => {
		throw new FlowFailError(input.message);
	},
};
