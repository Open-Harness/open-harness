/**
 * Plan Creator Agent
 *
 * Analyzes PRD and creates milestones with tasks.
 * Activated by workflow:start or replan:requested.
 */

import type { ReactiveAgentConfig, ScopedReactiveAgent } from "@internal/core";
import { type PlanOutput, PlanOutputSchema } from "../schemas.js";
import type { PRDWorkflowState } from "../types.js";

/**
 * Create the plan creator agent.
 *
 * @param agent - The workflow agent factory
 * @returns Plan creator agent definition
 */
export function createPlanCreatorAgent(
	agent: <TOutput>(
		config: ReactiveAgentConfig<TOutput, PRDWorkflowState>,
	) => ScopedReactiveAgent<TOutput, PRDWorkflowState>,
): ScopedReactiveAgent<PlanOutput, PRDWorkflowState> {
	return agent({
		prompt: `
Use /prd-planner skill.

You are the planning agent for a PRD-driven development workflow. Your job is to analyze the PRD and create a structured implementation plan.

## Input Context

PRD:
{{ state.prd }}

Current milestones (if replanning):
{{ state.planning.milestones }}

All existing tasks:
{{ state.planning.allTasks }}

Workflow history:
{{ state.history }}

Replan count: {{ state.planning.replanCount }}

## Your Task

1. If this is the initial plan (replanCount === 0):
   - Analyze the PRD thoroughly
   - Identify natural milestones (deliverable chunks of functionality)
   - Break each milestone into specific, actionable tasks
   - Define clear acceptance tests for each milestone

2. If replanning (replanCount > 0):
   - Review history to understand what failed
   - Adjust the approach based on lessons learned
   - Create a new plan that addresses the issues

## Output Format

Provide your output as structured JSON matching the PlanOutput schema.

Each task should have:
- A clear, specific title
- Detailed description of what needs to be done
- Definition of done (specific, testable criteria)
- Files to modify/create if known
- Dependencies on other tasks (by title)

Each milestone should have:
- A clear title
- Description of what this milestone delivers
- An acceptance test (automated if possible)
- Tasks needed to complete the milestone
- Dependencies on other milestones (by title)
`,
		activateOn: ["workflow:start", "replan:requested"],
		emits: ["plan:created"],
		output: { schema: PlanOutputSchema },
	});
}
