/**
 * Reviewer Agent Types & Utilities - Level 5
 *
 * Pure types and parsing utilities for reviewer agent output.
 * The agent itself is defined in speckit-harness.ts.
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
