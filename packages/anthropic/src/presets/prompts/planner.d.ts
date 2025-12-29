/**
 * Planner Agent Prompt Template
 *
 * Type-safe prompt for the PlannerAgent preset.
 * Replaces the markdown file src/agents/planner.prompt.md.
 *
 * @module presets/prompts/planner
 */
import { z } from "zod";
import type { PlannerInput } from "../../provider/types.js";
/**
 * Input schema for the planner prompt.
 */
export declare const PlannerInputSchema: z.ZodObject<{
    prd: z.ZodString;
}, z.core.$strip>;
/**
 * Task schema for planned work items.
 */
export declare const PlannerTaskSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    dependencies: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
/**
 * Output schema for structured planning results.
 */
export declare const PlannerOutputSchema: z.ZodObject<{
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        dependencies: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Raw template string for the planner prompt.
 */
export declare const PLANNER_TEMPLATE: "# Planner Agent\n\nYou are a project planner. Break down the following PRD into development tickets.\n\n## PRD\n\n{{prd}}\n\n## Instructions\n\n1. Analyze the requirements and identify distinct development tasks\n2. Create 3-5 focused tickets that together implement the full PRD\n3. Each ticket should be independently implementable\n4. Order tickets by logical dependency (foundational work first)\n5. Include dependencies between tasks where one task must complete before another can start\n\n## Output Format\n\nReturn a JSON object with a \"tasks\" array:\n\n```json\n{\n  \"tasks\": [\n    {\n      \"id\": \"TASK-1\",\n      \"title\": \"Short descriptive title\",\n      \"description\": \"Detailed description of what needs to be implemented\",\n      \"dependencies\": []\n    },\n    {\n      \"id\": \"TASK-2\",\n      \"title\": \"Another task\",\n      \"description\": \"This task depends on TASK-1\",\n      \"dependencies\": [\"TASK-1\"]\n    }\n  ]\n}\n```\n";
/**
 * Planner agent prompt template.
 *
 * Guides the agent to break down a PRD into development tasks.
 * Uses {{prd}} variable for interpolation.
 */
export declare const PlannerPromptTemplate: import("../../index.js").PromptTemplate<PlannerInput>;
