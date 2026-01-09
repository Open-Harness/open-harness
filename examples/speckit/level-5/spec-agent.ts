import { agent } from "@open-harness/core";

/**
 * Spec Agent - Level 4
 *
 * Takes a PRD (Product Requirements Document) and breaks it down into
 * structured, actionable tasks. This is the first agent in the SpecKit
 * workflow.
 *
 * The Spec Agent's responsibilities:
 * 1. Parse and understand the PRD
 * 2. Identify discrete implementation tasks
 * 3. Prioritize tasks by dependency and importance
 * 4. Define clear acceptance criteria for each task
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
 * State for the Spec Agent
 */
export interface SpecAgentState {
	prdReceived: boolean;
	tasksGenerated: number;
	[key: string]: unknown;
}

export const initialSpecState: SpecAgentState = {
	prdReceived: false,
	tasksGenerated: 0,
};

/**
 * The spec agent analyzes PRDs and produces task lists.
 *
 * Output format (text-based):
 * - TASKS section with numbered tasks
 * - Each task has: ID, Title, Description, Priority, Complexity, Criteria
 * - SUMMARY with total task count
 */
export const specAgent = agent({
	prompt: `You are a specification agent that analyzes PRDs (Product Requirements Documents).

Your job is to break down a PRD into clear, actionable implementation tasks.

For each task, provide:
1. A unique ID (TASK-001, TASK-002, etc.)
2. A concise title
3. A detailed description of what needs to be done
4. Priority (1-5, where 1 is highest)
5. Complexity estimate (simple, medium, complex)
6. Clear acceptance criteria (what must be true when done)

Your response MUST follow this format:

## TASKS

### TASK-001: [Title]
**Priority:** [1-5]
**Complexity:** [simple|medium|complex]
**Description:** [What needs to be done]
**Acceptance Criteria:**
- [Criterion 1]
- [Criterion 2]

### TASK-002: [Title]
...

## SUMMARY
Total tasks: [N]
By priority: [breakdown]
By complexity: [breakdown]

## STATUS
COMPLETE or NEEDS_MORE_CONTEXT

Important guidelines:
- Each task should be independently implementable
- Order tasks by dependency (prerequisites first)
- Be specific - vague tasks are useless
- Don't create too many tiny tasks - group related work`,

	state: initialSpecState,
});

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
