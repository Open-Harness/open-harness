/**
 * Dependency Resolver - Topological sorting and cycle detection for tasks
 *
 * Implements Kahn's algorithm for topological sorting of tasks based on
 * their dependencies. Also provides cycle detection.
 *
 * @module harness/dependency-resolver
 */

import type { ParsedTask } from "./task-harness-types.js";

/**
 * Result of topological sort operation.
 */
export interface TopologicalSortResult {
	/** Sorted task IDs in execution order */
	sorted: string[];
	/** Whether sort was successful (no cycles) */
	success: boolean;
	/** Detected cycles if any */
	cycles: string[][];
	/** Tasks that could not be sorted due to cycles */
	unsortable: string[];
}

/**
 * Resolve task dependencies and return execution order.
 *
 * Uses Kahn's algorithm for topological sorting:
 * 1. Build adjacency list from dependencies
 * 2. Track in-degree (dependency count) for each task
 * 3. Start with tasks having in-degree 0
 * 4. As each task completes, decrement dependents' in-degrees
 * 5. Queue newly-ready tasks (in-degree becomes 0)
 *
 * @param tasks - Array of parsed tasks with dependencies
 * @returns Topological sort result with sorted order or cycle information
 *
 * @example
 * ```typescript
 * const tasks = [
 *   { id: "T001", dependencies: [] },
 *   { id: "T002", dependencies: ["T001"] },
 *   { id: "T003", dependencies: ["T001", "T002"] },
 * ];
 *
 * const result = resolveDependencies(tasks);
 * // result.sorted = ["T001", "T002", "T003"]
 * // result.success = true
 * ```
 */
export function resolveDependencies(tasks: Pick<ParsedTask, "id" | "dependencies">[]): TopologicalSortResult {
	const taskIds = new Set(tasks.map((t) => t.id));
	const inDegree = new Map<string, number>();
	const adjList = new Map<string, string[]>();

	// Initialize in-degree and adjacency list
	for (const task of tasks) {
		inDegree.set(task.id, 0);
		adjList.set(task.id, []);
	}

	// Build graph: dependency -> dependent
	// If T002 depends on T001, add edge T001 -> T002
	for (const task of tasks) {
		for (const dep of task.dependencies) {
			// Only count dependencies that exist in our task set
			if (taskIds.has(dep)) {
				adjList.get(dep)?.push(task.id);
				inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
			}
		}
	}

	// Kahn's algorithm: process tasks with no dependencies first
	const queue: string[] = [];
	for (const [id, degree] of inDegree) {
		if (degree === 0) {
			queue.push(id);
		}
	}

	const sorted: string[] = [];
	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) break;
		sorted.push(current);

		// Decrement in-degree of all dependents
		for (const neighbor of adjList.get(current) ?? []) {
			const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
			inDegree.set(neighbor, newDegree);

			// If dependent has no more dependencies, add to queue
			if (newDegree === 0) {
				queue.push(neighbor);
			}
		}
	}

	// Check if all tasks were sorted
	if (sorted.length === tasks.length) {
		return {
			sorted,
			success: true,
			cycles: [],
			unsortable: [],
		};
	}

	// Some tasks couldn't be sorted - detect cycles
	const unsortable = tasks.filter((t) => !sorted.includes(t.id)).map((t) => t.id);
	const cycles = detectCycles(tasks, taskIds);

	return {
		sorted,
		success: false,
		cycles,
		unsortable,
	};
}

/**
 * Detect dependency cycles using DFS.
 *
 * @param tasks - Array of tasks to check
 * @param validIds - Set of valid task IDs
 * @returns Array of detected cycles
 */
export function detectCycles(tasks: Pick<ParsedTask, "id" | "dependencies">[], validIds?: Set<string>): string[][] {
	const taskMap = new Map(tasks.map((t) => [t.id, t]));
	const validTaskIds = validIds ?? new Set(tasks.map((t) => t.id));

	const cycles: string[][] = [];
	const visited = new Set<string>();
	const recStack = new Set<string>();

	const dfs = (taskId: string, path: string[]): void => {
		// If in recursion stack, we found a cycle
		if (recStack.has(taskId)) {
			const cycleStart = path.indexOf(taskId);
			if (cycleStart !== -1) {
				cycles.push([...path.slice(cycleStart), taskId]);
			}
			return;
		}

		// Already fully processed
		if (visited.has(taskId)) {
			return;
		}

		visited.add(taskId);
		recStack.add(taskId);

		const task = taskMap.get(taskId);
		if (task) {
			for (const dep of task.dependencies) {
				// Only follow valid dependencies
				if (validTaskIds.has(dep)) {
					dfs(dep, [...path, taskId]);
				}
			}
		}

		recStack.delete(taskId);
	};

	for (const task of tasks) {
		if (!visited.has(task.id)) {
			dfs(task.id, []);
		}
	}

	return cycles;
}

/**
 * Get tasks that are ready to execute (no pending dependencies).
 *
 * @param tasks - All tasks
 * @param completedIds - Set of completed task IDs
 * @returns Array of tasks ready to execute
 */
export function getReadyTasks(
	tasks: Pick<ParsedTask, "id" | "dependencies" | "status">[],
	completedIds: Set<string>,
): string[] {
	return tasks
		.filter((task) => {
			// Skip already completed
			if (task.status === "complete" || completedIds.has(task.id)) {
				return false;
			}

			// Check all dependencies are completed
			return task.dependencies.every((dep) => completedIds.has(dep));
		})
		.map((t) => t.id);
}

/**
 * Validate dependency references.
 *
 * @param tasks - Tasks to validate
 * @returns Array of warning messages for invalid references
 */
export function validateDependencies(tasks: Pick<ParsedTask, "id" | "dependencies">[]): string[] {
	const taskIds = new Set(tasks.map((t) => t.id));
	const warnings: string[] = [];

	for (const task of tasks) {
		for (const dep of task.dependencies) {
			if (!taskIds.has(dep)) {
				warnings.push(`Task ${task.id} references unknown dependency: ${dep}`);
			}
		}
	}

	return warnings;
}
