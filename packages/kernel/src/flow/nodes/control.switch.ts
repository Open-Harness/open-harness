// Flow Node: control.switch
// Multi-way routing based on value matching cases

import { z } from "zod";
import type {
	ControlNodeContext,
	NodeTypeDefinition,
	WhenExpr,
} from "../../protocol/flow.js";
import { WhenExprSchema } from "../validator.js";
import { evaluateWhen } from "../when.js";

/**
 * A single case in a switch statement
 */
const SwitchCaseSchema = z.object({
	when: WhenExprSchema.describe("Condition to match for this case"),
	route: z.string().describe("Route identifier when this case matches"),
});

/**
 * Input schema for control.switch
 * @see spec.md Appendix A1 - control.switch
 */
const SwitchInputSchema = z.object({
	value: z.unknown().describe("The value being switched on (for passthrough)"),
	cases: z
		.array(SwitchCaseSchema)
		.describe("Array of cases to evaluate in order"),
});

/**
 * Output schema for control.switch
 */
const SwitchOutputSchema = z.object({
	route: z.string().describe("The matched route identifier, or 'default'"),
	value: z.unknown().describe("The original value passed through"),
});

type SwitchInput = z.infer<typeof SwitchInputSchema>;
type SwitchOutput = z.infer<typeof SwitchOutputSchema>;

/**
 * control.switch node type definition.
 *
 * Evaluates cases in order and routes to the first matching case.
 * If no case matches, routes to "default".
 *
 * The node requires binding context to resolve variable paths in
 * WhenExpr conditions.
 *
 * Example YAML usage:
 * ```yaml
 * nodes:
 *   - id: route-by-type
 *     type: control.switch
 *     input:
 *       value: "{{ classifier.type }}"
 *       cases:
 *         - when:
 *             equals:
 *               var: classifier.type
 *               value: "bug"
 *           route: bug-handler
 *         - when:
 *             equals:
 *               var: classifier.type
 *               value: "feature"
 *           route: feature-handler
 *         - when:
 *             equals:
 *               var: classifier.type
 *               value: "question"
 *           route: question-handler
 *
 *   - id: bug-handler
 *     type: echo
 *     input:
 *       message: "Handling bug..."
 *
 * edges:
 *   - from: route-by-type
 *     to: bug-handler
 *     when:
 *       equals:
 *         var: route-by-type.route
 *         value: "bug-handler"
 * ```
 */
export const controlSwitchNode: NodeTypeDefinition<SwitchInput, SwitchOutput> =
	{
		type: "control.switch",
		inputSchema: SwitchInputSchema,
		outputSchema: SwitchOutputSchema,
		capabilities: {
			needsBindingContext: true,
		},
		metadata: {
			displayName: "Switch",
			description: "Multi-way routing by matching cases",
			category: "control",
			color: "#8b5cf6", // Purple for multi-way branching
		},
		run: async (ctx, input) => {
			// Cast to ControlNodeContext to access bindingContext
			const controlCtx = ctx as ControlNodeContext;

			if (!controlCtx.bindingContext) {
				throw new Error(
					"control.switch requires binding context but none was provided",
				);
			}

			// Evaluate cases in order, return first match (async for JSONata support)
			for (const switchCase of input.cases) {
				const matches = await evaluateWhen(
					switchCase.when as WhenExpr,
					controlCtx.bindingContext,
				);
				if (matches) {
					return {
						route: switchCase.route,
						value: input.value,
					};
				}
			}

			// No case matched - return default route
			return {
				route: "default",
				value: input.value,
			};
		},
	};
