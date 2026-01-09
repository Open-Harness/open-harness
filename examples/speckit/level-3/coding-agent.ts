import { agent } from "@open-harness/core";

/**
 * Coding Agent - Level 3
 *
 * Implements tasks with self-validation. The key concept here is that
 * agents can validate their own output and iterate until quality thresholds
 * are met (or max attempts reached).
 *
 * Self-validation pattern:
 * 1. Produce implementation
 * 2. Validate against criteria
 * 3. If validation fails, note issues for next attempt
 * 4. Repeat until validation passes or max attempts reached
 */

/**
 * Validation result tracks whether implementation passes quality checks
 */
export interface ValidationResult {
	passed: boolean;
	issues: string[];
}

/**
 * State tracks attempts and validation history
 */
export interface CodingAgentState {
	attempts: number;
	lastValidation: ValidationResult | null;
	maxAttempts: number;
	[key: string]: unknown;
}

export const initialState: CodingAgentState = {
	attempts: 0,
	lastValidation: null,
	maxAttempts: 3,
};

/**
 * The coding agent implements a task and validates its own work.
 *
 * Output format (text-based for now):
 * - CODE section with implementation
 * - VALIDATION section with self-assessment
 * - STATUS: COMPLETE, NEEDS_REVISION, or BLOCKED
 */
export const codingAgent = agent({
	prompt: `You are a coding agent that implements tasks and validates its own work.

Given a task, you must:
1. Implement a solution
2. Self-validate your implementation against quality criteria
3. Be honest about issues - don't claim success if there are problems

Your response MUST include these sections:

## CODE
\`\`\`
[Your implementation here]
\`\`\`

## VALIDATION
- List each criterion you checked
- Mark each as PASS or FAIL
- Explain any failures

## ISSUES (if any)
- List specific problems found
- Suggest fixes for next attempt

## STATUS
One of:
- COMPLETE: Implementation passes all validation
- NEEDS_REVISION: Found issues, need another attempt
- BLOCKED: Cannot complete (explain why)

Be critical of your own work. It's better to catch issues now than deploy broken code.`,

	state: initialState,
});

/**
 * Parse the agent's text output to extract validation status.
 * Returns true if the output indicates COMPLETE status.
 */
export function parseValidationStatus(output: string): {
	passed: boolean;
	status: "complete" | "needs_revision" | "blocked";
	issues: string[];
} {
	const outputUpper = output.toUpperCase();

	// Extract status
	let status: "complete" | "needs_revision" | "blocked" = "needs_revision";
	if (outputUpper.includes("STATUS") && outputUpper.includes("COMPLETE")) {
		if (!outputUpper.includes("NEEDS_REVISION")) {
			status = "complete";
		}
	}
	if (outputUpper.includes("STATUS") && outputUpper.includes("BLOCKED")) {
		status = "blocked";
	}

	// Extract issues section
	const issues: string[] = [];
	const issuesMatch = output.match(/## ISSUES[\s\S]*?(?=## |$)/i);
	if (issuesMatch) {
		const issueLines = issuesMatch[0].split("\n").filter((line) => line.trim().startsWith("-"));
		issues.push(...issueLines.map((line) => line.replace(/^-\s*/, "").trim()));
	}

	return {
		passed: status === "complete",
		status,
		issues,
	};
}
