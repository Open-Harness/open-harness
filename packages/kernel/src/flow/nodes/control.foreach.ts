// Flow Node: control.foreach
// Container node for iterating over arrays with session isolation

import { z } from "zod";
import type {
	ContainerNodeContext,
	ForeachInput,
	ForeachOutput,
	NodeTypeDefinition,
} from "../../protocol/flow.js";
import { createSessionId } from "../../protocol/session.js";

const ForeachInputSchema = z.object({
	items: z.array(z.unknown()).describe("Array of items to iterate over"),
	as: z.string().describe("Variable name to bind each item to"),
	body: z.array(z.string()).describe("Child node IDs to execute per iteration"),
});

const ForeachOutputSchema = z.object({
	iterations: z.array(
		z.object({
			item: z.unknown(),
			sessionId: z.string(),
			outputs: z.record(z.string(), z.unknown()),
		}),
	),
});

/**
 * Control.foreach node type definition.
 *
 * Iterates over an array of items, executing child nodes for each item
 * with a fresh session scope per iteration.
 *
 * Example YAML usage:
 * ```yaml
 * nodes:
 *   - id: process-tasks
 *     type: control.foreach
 *     input:
 *       items: "{{ taskCreator.tasks }}"
 *       as: "task"
 *       body:
 *         - ask-user
 *         - process-response
 * ```
 */
export const controlForeachNode: NodeTypeDefinition<
	ForeachInput,
	ForeachOutput
> = {
	type: "control.foreach",
	inputSchema: ForeachInputSchema,
	outputSchema: ForeachOutputSchema,
	capabilities: {
		isContainer: true,
		createsSession: true,
	},
	run: async (ctx, input) => {
		// Type assertion: container nodes receive ContainerNodeContext
		const containerCtx = ctx as ContainerNodeContext;
		const iterations: ForeachOutput["iterations"] = [];

		for (const item of input.items) {
			// Create fresh session for this iteration
			const sessionId = createSessionId();
			const outputs: Record<string, unknown> = {};

			// Emit session:start event
			containerCtx.hub.emit({
				type: "session:start",
				sessionId,
				parentSessionId: undefined, // TODO: track parent session
				nodeId: "control.foreach",
			});

			try {
				// Execute child nodes with session context
				for (const childId of input.body) {
					// Build input for child with loop variable binding
					const childInput = {
						[input.as]: item,
						sessionId,
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
					nodeId: "control.foreach",
				});
			}

			iterations.push({ item, sessionId, outputs });
		}

		return { iterations };
	},
};

/**
 * Creates a control.foreach node with custom configuration.
 */
export function createForeachNode(): NodeTypeDefinition<
	ForeachInput,
	ForeachOutput
> {
	return controlForeachNode;
}
