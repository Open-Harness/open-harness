/**
 * Planner Agent Prompt Template
 *
 * Type-safe prompt for the PlannerAgent preset.
 * Replaces the markdown file src/agents/planner.prompt.md.
 *
 * @module presets/prompts/planner
 */

import { z } from "zod";
import { createPromptTemplate } from "../../provider/prompt-template.js";
import type { PlannerInput } from "../../provider/types.js";

/**
 * Input schema for the planner prompt.
 */
export const PlannerInputSchema = z.object({
	/** Product Requirements Document to break into tasks */
	prd: z.string().min(1, "PRD is required"),
});

/**
 * Task schema for planned work items.
 */
export const PlannerTaskSchema = z.object({
	/** Unique task identifier */
	id: z.string(),
	/** Task title */
	title: z.string(),
	/** Detailed task description */
	description: z.string(),
	/** IDs of tasks this depends on */
	dependencies: z.array(z.string()),
});

/**
 * Output schema for structured planning results.
 */
export const PlannerOutputSchema = z.object({
	/** Ordered list of tasks */
	tasks: z.array(PlannerTaskSchema),
});

/**
 * Raw template string for the planner prompt.
 */
export const PLANNER_TEMPLATE = `# Planner Agent

You are a project planner. Break down the following PRD into development tickets.

## PRD

{{prd}}

## Instructions

1. Analyze the requirements and identify distinct development tasks
2. Create 3-5 focused tickets that together implement the full PRD
3. Each ticket should be independently implementable
4. Order tickets by logical dependency (foundational work first)
5. Include dependencies between tasks where one task must complete before another can start

## Output Format

Return a JSON object with a "tasks" array:

\`\`\`json
{
  "tasks": [
    {
      "id": "TASK-1",
      "title": "Short descriptive title",
      "description": "Detailed description of what needs to be implemented",
      "dependencies": []
    },
    {
      "id": "TASK-2",
      "title": "Another task",
      "description": "This task depends on TASK-1",
      "dependencies": ["TASK-1"]
    }
  ]
}
\`\`\`
` as const;

/**
 * Planner agent prompt template.
 *
 * Guides the agent to break down a PRD into development tasks.
 * Uses {{prd}} variable for interpolation.
 */
export const PlannerPromptTemplate = createPromptTemplate<
	typeof PLANNER_TEMPLATE,
	PlannerInput
>(
	PLANNER_TEMPLATE,
	PlannerInputSchema,
);
