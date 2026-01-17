/**
 * Planner Agent Prompt
 *
 * Extracted prompt function with typed context for the planner agent.
 * This separation enables:
 * - Testing prompt generation in isolation
 * - Iterating on prompts without touching agent code
 * - Clear contract via typed context interface
 */

/**
 * Context required to generate the planner prompt.
 * This is the minimal typed interface for prompt generation.
 */
export interface PlannerPromptContext {
	/** The PRD content to analyze */
	prd: string;
}

/**
 * Generate the planner agent prompt.
 *
 * The planner analyzes a PRD and extracts a structured plan with:
 * - Tasks: discrete, implementable units of work
 * - Milestones: groups of related tasks
 * - Task order: execution sequence based on dependencies
 *
 * @param ctx - The prompt context containing PRD content
 * @returns The complete prompt string for the planner agent
 *
 * @example
 * ```ts
 * const prompt = createPlannerPrompt({ prd: "# My PRD\n\n..." });
 * ```
 */
export function createPlannerPrompt(ctx: PlannerPromptContext): string {
	return `You are analyzing a Product Requirements Document (PRD) for implementation.

PRD Content:
${ctx.prd}

Your task:
1. Extract ALL tasks mentioned in the PRD as discrete, implementable units
2. Group related tasks into milestones
3. Determine the optimal execution order based on dependencies

For each task, provide:
- A unique ID (e.g., "task-1", "task-2")
- A short, descriptive title
- A detailed description of what needs to be done
- Clear definition of done criteria (checkable items)
- The milestone ID it belongs to

For each milestone, provide:
- A unique ID (e.g., "milestone-1", "milestone-2")
- A short, descriptive title
- The IDs of tasks belonging to this milestone (in order)
- Optionally, a test command to verify milestone completion

Return the complete taskOrder array with all task IDs in execution order.

Be thorough and extract every actionable item from the PRD.`;
}
