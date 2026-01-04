/**
 * Reviewer Output Schema
 *
 * Defines the structured output for the reviewer node.
 * The reviewer evaluates the coder's implementation and provides feedback.
 */

import { z } from "zod";

export const schema = z.object({
	passed: z.boolean().describe("Whether the implementation passed review"),
	feedback: z.string().describe("Summary of the review"),
	issues: z
		.array(z.string())
		.default([])
		.describe("Specific issues that need to be addressed"),
});

export type ReviewerOutput = z.infer<typeof schema>;
