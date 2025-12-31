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

function getAttemptFromRunId(runId: string): number {
	const parts = runId.split("-");
	if (parts.length < 4) return 1;
	const attempt = Number(parts[2]);
	return Number.isFinite(attempt) ? attempt : 1;
}

export const flakyNode: NodeTypeDefinition<
	{ label: string },
	{ label: string; attempt: number }
> = {
	type: "tutorial.flaky",
	inputSchema: z.object({ label: z.string() }),
	outputSchema: z.object({ label: z.string(), attempt: z.number() }),
	run: async (ctx, input) => {
		const attempt = getAttemptFromRunId(ctx.runId);
		if (attempt < 2) {
			throw new Error("flaky: retry me");
		}
		return { label: input.label, attempt };
	},
};

export const delayNode: NodeTypeDefinition<{ ms: number }, { waitedMs: number }> =
	{
		type: "tutorial.delay",
		inputSchema: z.object({ ms: z.number().int().nonnegative() }),
		outputSchema: z.object({ waitedMs: z.number() }),
		run: async (_ctx, input) => {
			await new Promise<void>((resolve) => {
				setTimeout(resolve, input.ms);
			});
			return { waitedMs: input.ms };
		},
	};

export const failNode: NodeTypeDefinition<{ reason: string }, never> = {
	type: "tutorial.fail",
	inputSchema: z.object({ reason: z.string() }),
	outputSchema: z.never(),
	run: async (_ctx, input) => {
		throw new Error(input.reason);
	},
};

export const tutorialPack: NodePack = {
	register: (registry) => {
		registry.register(uppercaseNode);
		registry.register(flakyNode);
		registry.register(delayNode);
		registry.register(failNode);
	},
};
