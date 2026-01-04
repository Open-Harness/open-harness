/**
 * Planner Output Schema
 *
 * Defines the structured output for the planner node.
 * The planner breaks down a feature request into atomic, implementable tasks.
 */

import { z } from "zod";

export const schema = z.object({
	tasks: z.array(
		z.object({
			id: z.string().describe("Unique task identifier (e.g., 'task-1')"),
			title: z.string().describe("Short descriptive title"),
			description: z
				.string()
				.describe("Detailed description of what to implement"),
			dependencies: z
				.array(z.string())
				.default([])
				.describe("IDs of tasks this task depends on"),
		}),
	),
});

export type PlannerOutput = z.infer<typeof schema>;
