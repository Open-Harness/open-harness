import { z } from "zod";
import type { NodeTypeDefinition } from "../../protocol/flow.js";

export const constantNode: NodeTypeDefinition<
	{ value: unknown },
	{ value: unknown }
> = {
	type: "constant",
	inputSchema: z.object({ value: z.unknown() }),
	outputSchema: z.object({ value: z.unknown() }),
	run: async (_ctx, input) => {
		return { value: input.value };
	},
};
