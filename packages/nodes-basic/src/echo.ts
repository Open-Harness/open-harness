import type { NodeTypeDefinition } from "@internal/nodes";
import { z } from "zod";

/**
 * Input schema for echo node.
 */
const EchoInputSchema = z.object({
	text: z.string(),
});

/**
 * Output schema for echo node.
 */
const EchoOutputSchema = z.object({
	text: z.string(),
});

/**
 * Echo node returns the provided text input.
 */
export const echoNode: NodeTypeDefinition<
	z.infer<typeof EchoInputSchema>,
	z.infer<typeof EchoOutputSchema>
> = {
	type: "echo",
	inputSchema: EchoInputSchema,
	outputSchema: EchoOutputSchema,
	run: async (_ctx, input) => ({ text: input.text }),
};
