// Flow Node: control.noop
// Structural passthrough node that does nothing but propagate values

import { z } from "zod";
import type { NodeTypeDefinition } from "../../protocol/flow.js";

/**
 * Input schema for control.noop
 * @see spec.md Appendix A1 - control.noop
 */
const NoopInputSchema = z.object({
	value: z.unknown().optional().describe("Optional value to pass through"),
});

/**
 * Output schema for control.noop
 */
const NoopOutputSchema = z.object({
	value: z.unknown().optional().describe("The same value that was passed in"),
});

type NoopInput = z.infer<typeof NoopInputSchema>;
type NoopOutput = z.infer<typeof NoopOutputSchema>;

/**
 * control.noop node type definition.
 *
 * A structural-only node that passes through its input value unchanged.
 * Useful for:
 * - Creating merge points in the flow graph
 * - Adding explicit synchronization points
 * - Placeholder nodes during flow development
 *
 * Example YAML usage:
 * ```yaml
 * nodes:
 *   - id: sync-point
 *     type: control.noop
 *     input:
 *       value: "{{ previousNode.result }}"
 * ```
 */
export const controlNoopNode: NodeTypeDefinition<NoopInput, NoopOutput> = {
	type: "control.noop",
	inputSchema: NoopInputSchema,
	outputSchema: NoopOutputSchema,
	capabilities: {
		// No special capabilities - pure passthrough
	},
	metadata: {
		displayName: "No-Op",
		description: "Structural passthrough node",
		category: "control",
	},
	run: async (_ctx, input) => {
		// Simply return the value unchanged
		return { value: input.value };
	},
};
