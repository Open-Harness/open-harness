/**
 * Coder Output Schema
 *
 * Defines the structured output for the coder node.
 * The coder implements a task and returns the files to create/modify.
 */

import { z } from "zod";

export const schema = z.object({
	files: z.array(
		z.object({
			path: z.string().describe("Relative file path from project root"),
			content: z.string().describe("Complete file content"),
			action: z
				.enum(["create", "modify", "delete"])
				.default("create")
				.describe("What action to take on this file"),
		}),
	),
	explanation: z
		.string()
		.describe("Brief explanation of the implementation approach"),
	dependencies: z
		.array(z.string())
		.optional()
		.describe("Any new package dependencies needed"),
});

export type CoderOutput = z.infer<typeof schema>;
