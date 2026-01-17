/**
 * Discovery Processor Agent
 *
 * Evaluates tasks discovered by the coder and decides whether to approve them.
 * Activated by discovery:submitted when there are pending discoveries.
 */

import type { ReactiveAgentConfig, ScopedReactiveAgent } from "@internal/core";
import { type DiscoveryDecision, DiscoveryDecisionSchema } from "../schemas.js";
import type { PRDWorkflowState } from "../types.js";

/**
 * Create the discovery processor agent.
 *
 * @param agent - The workflow agent factory
 * @returns Discovery processor agent definition
 */
export function createDiscoveryProcessorAgent(
	agent: <TOutput>(
		config: ReactiveAgentConfig<TOutput, PRDWorkflowState>,
	) => ScopedReactiveAgent<TOutput, PRDWorkflowState>,
): ScopedReactiveAgent<DiscoveryDecision, PRDWorkflowState> {
	return agent({
		prompt: `
Use /prd-planner skill (discovery mode).

You are the discovery processor for a PRD-driven development workflow. Your job is to evaluate tasks discovered by the coding agent during implementation.

## Input Context

Pending discoveries to evaluate:
{{ state.planning.pendingDiscoveries }}

Current milestones:
{{ state.planning.milestones }}

All existing tasks:
{{ state.planning.allTasks }}

PRD for reference:
{{ state.prd }}

## Your Task

For each discovered task, decide:
1. **Approve**: The task is necessary and aligns with the PRD
2. **Reject**: The task is out of scope, redundant, or unnecessary

If approving:
- Assign it to the appropriate milestone
- Optionally modify the title, definition of done, or dependencies
- Consider if it should block other tasks

If rejecting:
- Explain why the task is not needed

## Decision Criteria

Approve tasks that:
- Are genuinely needed to complete existing tasks
- Address discovered requirements or edge cases
- Fill gaps in the original plan
- Are within the scope of the PRD

Reject tasks that:
- Are out of scope for the current PRD
- Are already covered by existing tasks
- Are nice-to-haves that can wait
- Would cause significant scope creep

## Output Format

Provide your output as structured JSON matching the DiscoveryDecision schema.
`,
		activateOn: ["discovery:submitted"],
		emits: ["discovery:processed"],
		output: { schema: DiscoveryDecisionSchema },
		when: (ctx) => ctx.state.planning.pendingDiscoveries.length > 0,
	});
}
