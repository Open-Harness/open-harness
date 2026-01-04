// Flow Node: control.if
// Binary branch control node that evaluates a WhenExpr condition

import { z } from "zod";
import type {
	ControlNodeContext,
	NodeTypeDefinition,
	WhenExpr,
} from "../../protocol/flow.js";
import { WhenExprSchema } from "../validator.js";
import { evaluateWhen } from "../when.js";

/**
 * Input schema for control.if
 * @see spec.md Appendix A1 - control.if
 */
const IfInputSchema = z.object({
	condition: WhenExprSchema.describe(
		"WhenExpr condition to evaluate (e.g., { equals: { var: 'x.y', value: 'z' } })",
	),
});

/**
 * Output schema for control.if
 */
const IfOutputSchema = z.object({
	condition: z.boolean().describe("Result of evaluating the condition"),
});

type IfInput = z.infer<typeof IfInputSchema>;
type IfOutput = z.infer<typeof IfOutputSchema>;

/**
 * control.if node type definition.
 *
 * Evaluates a WhenExpr condition and outputs a boolean result.
 * This enables binary branching in flows via edge `when` conditions.
 *
 * The node requires binding context to resolve variable paths in the
 * WhenExpr (e.g., "someNode.result" or "flow.input.x").
 *
 * Example YAML usage:
 * ```yaml
 * nodes:
 *   - id: check-status
 *     type: control.if
 *     input:
 *       condition:
 *         equals:
 *           var: previousNode.status
 *           value: "success"
 *
 *   - id: handle-success
 *     type: echo
 *     input:
 *       message: "Success!"
 *
 *   - id: handle-failure
 *     type: echo
 *     input:
 *       message: "Failed!"
 *
 * edges:
 *   - from: check-status
 *     to: handle-success
 *     when:
 *       equals:
 *         var: check-status.condition
 *         value: true
 *   - from: check-status
 *     to: handle-failure
 *     when:
 *       equals:
 *         var: check-status.condition
 *         value: false
 * ```
 */
export const controlIfNode: NodeTypeDefinition<IfInput, IfOutput> = {
	type: "control.if",
	inputSchema: IfInputSchema,
	outputSchema: IfOutputSchema,
	capabilities: {
		needsBindingContext: true,
	},
	metadata: {
		displayName: "If",
		description: "Evaluate a condition for binary branching",
		category: "control",
		color: "#3b82f6", // Blue for decision/branching
	},
	run: async (ctx, input) => {
		// Cast to ControlNodeContext to access bindingContext
		const controlCtx = ctx as ControlNodeContext;

		if (!controlCtx.bindingContext) {
			throw new Error(
				"control.if requires binding context but none was provided",
			);
		}

		// Evaluate the WhenExpr condition (async for JSONata support)
		const condition = await evaluateWhen(
			input.condition as WhenExpr,
			controlCtx.bindingContext,
		);

		return { condition };
	},
};
