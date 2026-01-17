/**
 * Reviewer Agent
 *
 * Evaluates task completion and makes termination decisions.
 * Activated by task:complete or milestone:testable.
 */

import type { ReactiveAgentConfig, ScopedReactiveAgent } from "@internal/core";
import { type ReviewDecisionOutput, ReviewDecisionSchema } from "../schemas.js";
import type { PRDWorkflowState } from "../types.js";

/**
 * Create the reviewer agent.
 *
 * @param agent - The workflow agent factory
 * @returns Reviewer agent definition
 */
export function createReviewerAgent(
	agent: <TOutput>(
		config: ReactiveAgentConfig<TOutput, PRDWorkflowState>,
	) => ScopedReactiveAgent<TOutput, PRDWorkflowState>,
): ScopedReactiveAgent<ReviewDecisionOutput, PRDWorkflowState> {
	return agent({
		prompt: `
Use /prd-review skill.

You are the review agent for a PRD-driven development workflow. Your job is to evaluate whether tasks are complete and make decisions about next steps.

## Task Under Review

{{ state.review.currentTaskForReview }}

## Context

Milestone context:
{{ state.planning.milestones }}

PRD intent:
{{ state.prd }}

Review phase:
{{ state.review.phase }}

## If Reviewing a Task

Evaluate the task against its definition of done:
1. Check each criterion in definitionOfDone
2. Review the files changed
3. Verify the implementation matches the requirements
4. Assess whether progress was made (even if not complete)

## Iteration Context

Current attempt: {{ state.review.currentTaskForReview.attempt }}
Max attempts: {{ state.review.currentTaskForReview.maxAttempts }}
Attempt history: {{ state.review.currentTaskForReview.attemptHistory }}

## Decision Framework

### approved
Use when ALL definition of done criteria are met.

### needs_fix
Use when:
- Some criteria are met but not all
- attempt < maxAttempts
- There's a clear path to completion

Provide:
- Specific fixInstructions explaining what needs to change
- specificIssues listing each problem with file/suggestion

### escalate
Use when:
- attempt >= maxAttempts
- No progress is being made after multiple attempts
- The task is fundamentally blocked

Provide:
- escalationReason explaining why
- recommendedAction:
  - "skip" if task is non-critical and can be omitted
  - "replan" if the overall approach needs to change
  - "abort" if there's a fundamental blocker

## Progress Assessment

Always assess:
- progressMade: Was any forward motion made? (true/false)
- lessonsLearned: What can be learned from this attempt?

This helps with termination decisions. If no progress is made across attempts, that signals the need to try a different approach.

## If Reviewing a Milestone (milestone:testable)

Run the acceptance test if automated:
1. Execute the test command
2. Compare result to expectedOutcome
3. Decide approve or fail based on test result

## Output Format

Provide your output as structured JSON matching the ReviewDecision schema.
`,
		activateOn: ["task:complete", "milestone:testable"],
		emits: [
			"task:approved",
			"task:needs_fix",
			"task:blocked",
			"task:escalate",
			"milestone:complete",
			"milestone:failed",
		],
		output: { schema: ReviewDecisionSchema },
	});
}
