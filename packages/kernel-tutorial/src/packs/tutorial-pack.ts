import { z } from "zod";
import type { NodePack, NodeTypeDefinition } from "@open-harness/kernel";

export const uppercaseNode: NodeTypeDefinition<
	{ text: string },
	{ text: string }
> = {
	type: "tutorial.uppercase",
	inputSchema: z.object({ text: z.string() }),
	outputSchema: z.object({ text: z.string() }),
	run: async (_ctx, input) => {
		return { text: input.text.toUpperCase() };
	},
};

export const tutorialPack: NodePack = {
	register: (registry) => {
		registry.register(uppercaseNode);
	},
};
