// Flow Node: control.loop
// Container node for iterating while a condition is true

import { z } from "zod";
import type {
	ContainerNodeContext,
	ControlNodeContext,
	LoopInput,
	LoopOutput,
	NodeTypeDefinition,
	WhenExpr,
} from "../../protocol/flow.js";
import { createSessionId } from "../../protocol/session.js";
import { WhenExprSchema } from "../validator.js";
import { evaluateWhen } from "../when.js";

const LoopInputSchema = z.object({
	while: WhenExprSchema.describe("Condition to continue looping"),
	maxIterations: z
		.number()
		.int()
		.positive()
		.optional()
		.default(100)
		.describe("Maximum iterations (safety limit, default: 100)"),
	body: z.array(z.string()).describe("Child node IDs to execute per iteration"),
});

const LoopOutputSchema = z.object({
	iterations: z.array(
		z.object({
			iteration: z.number(),
			sessionId: z.string(),
			outputs: z.record(z.string(), z.unknown()),
		}),
	),
});

/**
 * control.loop node type definition.
 *
 * Repeatedly executes child nodes while a condition is true.
 * Each iteration gets a fresh session scope.
 *
 * Example YAML usage:
 * ```yaml
 * nodes:
 *   - id: retry-loop
 *     type: control.loop
 *     input:
 *       while:
 *         equals:
 *           var: lastAttempt.success
 *           value: false
 *       maxIterations: 3
 *       body:
 *         - attempt-operation
 *         - check-result
 * ```
 */
export const controlLoopNode: NodeTypeDefinition<LoopInput, LoopOutput> = {
	type: "control.loop",
	inputSchema: LoopInputSchema,
	outputSchema: LoopOutputSchema,
	capabilities: {
		isContainer: true,
		createsSession: true,
		needsBindingContext: true,
	},
	metadata: {
		displayName: "Loop",
		description: "Repeat while condition is true",
		category: "control",
		color: "#10b981", // Green for looping/iteration
	},
	run: async (ctx, input) => {
		// Type assertion: loop nodes receive combined context
		const containerCtx = ctx as ContainerNodeContext & ControlNodeContext;

		if (!containerCtx.bindingContext) {
			throw new Error(
				"control.loop requires binding context but none was provided",
			);
		}

		if (!containerCtx.executeChild) {
			throw new Error(
				"control.loop requires executeChild but none was provided",
			);
		}

		const iterations: LoopOutput["iterations"] = [];
		const maxIterations = input.maxIterations ?? 100;

		for (let iteration = 0; iteration < maxIterations; iteration++) {
			// Build binding context with loop metadata
			const loopBindingContext = {
				...containerCtx.bindingContext,
				loop: {
					iteration,
					continue: true, // Used for while condition
				},
			};

			// Evaluate while condition
			const shouldContinue = evaluateWhen(
				input.while as WhenExpr,
				loopBindingContext,
			);

			if (!shouldContinue) {
				break;
			}

			// Create fresh session for this iteration
			const sessionId = createSessionId();
			const outputs: Record<string, unknown> = {};

			// Emit session:start event
			containerCtx.hub.emit({
				type: "session:start",
				sessionId,
				parentSessionId: undefined,
				nodeId: "control.loop",
			});

			try {
				// Execute child nodes with session context
				for (const childId of input.body) {
					const childInput = {
						iteration,
						sessionId,
						loop: {
							iteration,
							continue: true,
						},
					};

					const childOutput = await containerCtx.executeChild(
						childId,
						childInput,
					);
					outputs[childId] = childOutput;
				}
			} finally {
				// Emit session:end event
				containerCtx.hub.emit({
					type: "session:end",
					sessionId,
					nodeId: "control.loop",
				});
			}

			iterations.push({ iteration, sessionId, outputs });
		}

		return { iterations };
	},
};
