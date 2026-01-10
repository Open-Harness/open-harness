/**
 * Coding Agent Types & Utilities - Level 7
 *
 * Pure types and parsing utilities for coding agent output.
 * The agent itself is defined in speckit-harness.ts.
 */

/**
 * Validation result structure
 */
export interface ValidationResult {
	passed: boolean;
	issues: string[];
}

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
