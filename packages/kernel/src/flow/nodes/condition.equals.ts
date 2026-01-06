import { z } from "zod";
import type { NodeTypeDefinition } from "../../protocol/flow.js";

export const conditionEqualsNode: NodeTypeDefinition<
	{ left: unknown; right: unknown },
	{ value: boolean }
> = {
	type: "condition.equals",
	inputSchema: z.object({ left: z.unknown(), right: z.unknown() }),
	outputSchema: z.object({ value: z.boolean() }),
	run: async (_ctx, input) => {
		const value = JSON.stringify(input.left) === JSON.stringify(input.right);
		return { value };
	},
};
