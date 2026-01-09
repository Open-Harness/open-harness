import { agent } from "@open-harness/core";

/**
 * Coding Agent - Level 4
 *
 * Implements tasks from the Spec Agent with self-validation.
 * Adapted from Level 3 to work within a harness context.
 *
 * The Coding Agent's responsibilities:
 * 1. Receive a task from the harness state
 * 2. Implement the task
 * 3. Self-validate the implementation
 * 4. Report status (complete, needs_revision, blocked)
 */

/**
 * Validation result structure
 */
export interface ValidationResult {
	passed: boolean;
	issues: string[];
}

/**
 * State for the Coding Agent
 */
export interface CodingAgentState {
	currentTaskId: string | null;
	attempts: number;
	lastValidation: ValidationResult | null;
	maxAttempts: number;
	[key: string]: unknown;
}

export const initialCodingState: CodingAgentState = {
	currentTaskId: null,
	attempts: 0,
	lastValidation: null,
	maxAttempts: 3,
};

/**
 * The coding agent implements tasks with self-validation.
 *
 * Output format (text-based):
 * - TASK_ID section identifying which task is being implemented
 * - CODE section with implementation
 * - VALIDATION section with self-assessment
 * - STATUS: COMPLETE, NEEDS_REVISION, or BLOCKED
 */
export const codingAgent = agent({
	prompt: `You are a coding agent that implements tasks from a specification.

You receive a task with:
- ID and title
- Description of what to implement
- Acceptance criteria to verify

Your job is to:
1. Implement the task
2. Validate your implementation against all acceptance criteria
3. Be honest about any issues

Your response MUST include these sections:

## TASK_ID
[The ID of the task you're implementing]

## CODE
\`\`\`
[Your implementation here]
\`\`\`

## VALIDATION
Check each acceptance criterion:
- [Criterion]: PASS or FAIL - [explanation]

## ISSUES (if any)
- [List specific problems]
- [Suggest fixes]

## STATUS
One of:
- COMPLETE: All acceptance criteria met
- NEEDS_REVISION: Some criteria not met, can fix with another attempt
- BLOCKED: Cannot complete (e.g., missing information)

Be thorough in your validation. Missing a criterion is worse than admitting a failure.`,
	// Note: State lives on the harness, not the agent
});

/**
 * Parse the coding agent's output.
 */
export function parseCodingOutput(output: string): {
	taskId: string | null;
	code: string;
	validation: ValidationResult;
	status: "complete" | "needs_revision" | "blocked";
} {
	// Extract task ID
	const taskIdMatch = output.match(/## TASK_ID\s*\n\s*(TASK-\d+)/i);
	const taskId = taskIdMatch?.[1] ?? null;

	// Extract code
	const codeMatch = output.match(/## CODE[\s\S]*?```[\s\S]*?\n([\s\S]*?)```/);
	const code = codeMatch?.[1]?.trim() ?? "";

	// Determine validation status
	const outputUpper = output.toUpperCase();
	let passed = false;
	if (outputUpper.includes("STATUS") && outputUpper.includes("COMPLETE")) {
		if (!outputUpper.includes("NEEDS_REVISION") && !outputUpper.includes("BLOCKED")) {
			passed = true;
		}
	}

	// Extract issues
	const issues: string[] = [];
	const issuesMatch = output.match(/## ISSUES[\s\S]*?(?=## |$)/i);
	if (issuesMatch) {
		const issueLines = issuesMatch[0].split("\n").filter((line) => line.trim().startsWith("-"));
		issues.push(...issueLines.map((line) => line.replace(/^-\s*/, "").trim()));
	}

	// Determine status
	let status: "complete" | "needs_revision" | "blocked" = "needs_revision";
	if (outputUpper.includes("STATUS")) {
		if (outputUpper.includes("COMPLETE") && !outputUpper.includes("NEEDS_REVISION")) {
			status = "complete";
		} else if (outputUpper.includes("BLOCKED")) {
			status = "blocked";
		}
	}

	return {
		taskId,
		code,
		validation: { passed, issues },
		status,
	};
}
