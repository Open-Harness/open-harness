import { agent } from "@open-harness/core";

/**
 * Reviewer Agent - Level 5
 *
 * Validates completed code against the original task specification.
 * This is the third agent in the SpecKit workflow, providing quality
 * assurance before marking a task as complete.
 *
 * The Reviewer Agent's responsibilities:
 * 1. Compare code against acceptance criteria
 * 2. Check for common issues (TODOs, incomplete sections)
 * 3. Verify code quality and best practices
 * 4. Provide actionable feedback if issues found
 */

/**
 * Issue found during review
 */
export interface ReviewIssue {
	severity: "blocker" | "major" | "minor";
	description: string;
	suggestion?: string;
}

/**
 * Criterion verification result
 */
export interface CriterionResult {
	criterion: string;
	met: boolean;
	notes?: string;
}

/**
 * State for the Reviewer Agent
 */
export interface ReviewerAgentState {
	reviewsCompleted: number;
	issuesFound: number;
	[key: string]: unknown;
}

export const initialReviewerState: ReviewerAgentState = {
	reviewsCompleted: 0,
	issuesFound: 0,
};

/**
 * The reviewer agent validates code against specifications.
 *
 * Output format (text-based):
 * - TASK_ID section identifying which task was reviewed
 * - CRITERIA section with pass/fail for each criterion
 * - ISSUES section with any problems found
 * - SUMMARY with overall assessment
 * - VERDICT: APPROVED or REJECTED
 */
export const reviewerAgent = agent({
	prompt: `You are a code reviewer agent that validates implementations against specifications.

You receive:
- A task specification with acceptance criteria
- The implemented code

Your job is to:
1. Check each acceptance criterion - is it truly met by the code?
2. Look for common issues (TODOs, incomplete sections, bugs)
3. Verify code quality and best practices
4. Provide constructive feedback

Your response MUST include these sections:

## TASK_ID
[The ID of the task being reviewed]

## CRITERIA VERIFICATION
For each acceptance criterion:
- [Criterion text]: MET or NOT_MET - [explanation]

## ISSUES
List any problems found:
- **[blocker|major|minor]**: [Description] → [Suggestion]

Issue severity guide:
- blocker: Completely broken, must fix before approval
- major: Significant problem, should fix
- minor: Small improvement, nice to have

## SUMMARY
[1-2 sentences summarizing the review]

## VERDICT
One of:
- APPROVED: All criteria met, no blockers
- REJECTED: Has blockers or multiple unmet criteria

Be thorough but fair. Don't reject for minor issues if core functionality works.`,

	state: initialReviewerState,
});

/**
 * Parse the reviewer agent's output.
 */
export function parseReviewerOutput(output: string): {
	taskId: string | null;
	criteriaResults: CriterionResult[];
	issues: ReviewIssue[];
	approved: boolean;
	summary: string;
} {
	// Extract task ID
	const taskIdMatch = output.match(/## TASK_ID\s*\n\s*(TASK-\d+)/i);
	const taskId = taskIdMatch?.[1] ?? null;

	// Extract criteria results
	const criteriaResults: CriterionResult[] = [];
	const criteriaSection = output.match(/## CRITERIA VERIFICATION[\s\S]*?(?=## ISSUES|## SUMMARY|$)/i);
	if (criteriaSection) {
		const criteriaLines = criteriaSection[0]
			.split("\n")
			.filter((line) => line.includes(": MET") || line.includes(": NOT_MET"));

		for (const line of criteriaLines) {
			const match = line.match(/-\s*(.+?):\s*(MET|NOT_MET)\s*-?\s*(.*)?/i);
			if (match) {
				criteriaResults.push({
					criterion: match[1]?.trim() ?? "",
					met: match[2]?.toUpperCase() === "MET",
					notes: match[3]?.trim() || undefined,
				});
			}
		}
	}

	// Extract issues
	const issues: ReviewIssue[] = [];
	const issuesSection = output.match(/## ISSUES[\s\S]*?(?=## SUMMARY|## VERDICT|$)/i);
	if (issuesSection) {
		const issueLines = issuesSection[0]
			.split("\n")
			.filter((line) => line.includes("**blocker**") || line.includes("**major**") || line.includes("**minor**"));

		for (const line of issueLines) {
			const match = line.match(/-\s*\*\*(blocker|major|minor)\*\*:\s*(.+?)(?:→|->)?\s*(.*)?/i);
			if (match) {
				issues.push({
					severity: match[1]?.toLowerCase() as ReviewIssue["severity"],
					description: match[2]?.trim() ?? "",
					suggestion: match[3]?.trim() || undefined,
				});
			}
		}
	}

	// Extract summary
	const summaryMatch = output.match(/## SUMMARY\s*\n([\s\S]*?)(?=## VERDICT|$)/i);
	const summary = summaryMatch?.[1]?.trim() ?? "";

	// Extract verdict
	const verdictMatch = output.match(/## VERDICT\s*\n\s*(APPROVED|REJECTED)/i);
	const approved = verdictMatch?.[1]?.toUpperCase() === "APPROVED";

	return {
		taskId,
		criteriaResults,
		issues,
		approved,
		summary,
	};
}
