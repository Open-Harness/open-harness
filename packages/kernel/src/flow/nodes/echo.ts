import { z } from "zod";
import type { NodeTypeDefinition } from "../../protocol/flow.js";

export const echoNode: NodeTypeDefinition<{ text: string }, { text: string }> =
	{
		type: "echo",
		inputSchema: z.object({ text: z.string() }),
		outputSchema: z.object({ text: z.string() }),
		run: async (_ctx, input) => {
			return { text: input.text };
		},
	};
