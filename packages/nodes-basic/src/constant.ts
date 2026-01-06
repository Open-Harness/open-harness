import type { NodeTypeDefinition } from "@internal/nodes";
import { z } from "zod";

/**
 * Input schema for constant node.
 */
const ConstantInputSchema = z.object({
	value: z.unknown(),
});

/**
 * Output schema for constant node.
 */
const ConstantOutputSchema = z.object({
	value: z.unknown(),
});

/**
 * Constant node returns a static value.
 */
export const constantNode: NodeTypeDefinition<
	z.infer<typeof ConstantInputSchema>,
	z.infer<typeof ConstantOutputSchema>
> = {
	type: "constant",
	inputSchema: ConstantInputSchema,
	outputSchema: ConstantOutputSchema,
	run: async (_ctx, input) => ({ value: input.value }),
};
