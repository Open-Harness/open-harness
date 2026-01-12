/**
 * Spec Agent Types & Utilities - Level 7
 *
 * Pure types and parsing utilities for spec agent output.
 * The agent itself is defined in speckit-harness.ts.
 */

/**
 * Task structure for the queue
 */
export interface Task {
	id: string;
	title: string;
	description: string;
	priority: number;
	complexity: "simple" | "medium" | "complex";
	acceptanceCriteria: string[];
}

/**
 * Parse the spec agent's output to extract tasks.
 */
export function parseSpecOutput(output: string): {
	tasks: Task[];
	status: "complete" | "needs_more_context";
} {
	const tasks: Task[] = [];

	// Extract task blocks
	const taskRegex = /### (TASK-\d+): (.+?)\n([\s\S]*?)(?=### TASK-|## SUMMARY|$)/g;
	const matches = output.matchAll(taskRegex);

	for (const match of matches) {
		const [, id, title, body] = match;
		if (!id || !title) continue;

		// Parse priority
		const priorityMatch = body?.match(/\*\*Priority:\*\*\s*(\d)/);
		const priority = priorityMatch ? parseInt(priorityMatch[1] ?? "3", 10) : 3;

		// Parse complexity
		const complexityMatch = body?.match(/\*\*Complexity:\*\*\s*(simple|medium|complex)/i);
		const complexity = (complexityMatch?.[1]?.toLowerCase() ?? "medium") as Task["complexity"];

		// Parse description
		const descMatch = body?.match(/\*\*Description:\*\*\s*(.+?)(?=\*\*|$)/s);
		const description = descMatch?.[1]?.trim() ?? "";

		// Parse acceptance criteria
		const criteriaMatch = body?.match(/\*\*Acceptance Criteria:\*\*([\s\S]*?)(?=###|## |$)/);
		const criteriaText = criteriaMatch?.[1] ?? "";
		const criteria = criteriaText
			.split("\n")
			.filter((line) => line.trim().startsWith("-"))
			.map((line) => line.replace(/^-\s*/, "").trim());

		tasks.push({
			id: id.trim(),
			title: title.trim(),
			description,
			priority,
			complexity,
			acceptanceCriteria: criteria,
		});
	}

	// Determine status
	const statusMatch = output.match(/## STATUS\s*(COMPLETE|NEEDS_MORE_CONTEXT)/i);
	const status =
		(statusMatch?.[1]?.toLowerCase().replace(/_/g, "_") as "complete" | "needs_more_context") ?? "complete";

	return { tasks, status };
}
