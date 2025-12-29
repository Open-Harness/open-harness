/**
 * Dependency Resolver - Topological sorting and cycle detection for tasks
 *
 * Implements Kahn's algorithm for topological sorting of tasks based on
 * their dependencies. Also provides cycle detection.
 *
 * @module harness/dependency-resolver
 */
/**
 * Minimal task interface for dependency resolution.
 * Only requires id and dependencies, optionally status.
 */
export interface DependencyTask {
    id: string;
    dependencies: string[];
    status?: string;
}
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
export declare function resolveDependencies(tasks: Pick<DependencyTask, "id" | "dependencies">[]): TopologicalSortResult;
/**
 * Detect dependency cycles using DFS.
 *
 * @param tasks - Array of tasks to check
 * @param validIds - Set of valid task IDs
 * @returns Array of detected cycles
 */
export declare function detectCycles(tasks: Pick<DependencyTask, "id" | "dependencies">[], validIds?: Set<string>): string[][];
/**
 * Get tasks that are ready to execute (no pending dependencies).
 *
 * @param tasks - All tasks
 * @param completedIds - Set of completed task IDs
 * @returns Array of tasks ready to execute
 */
export declare function getReadyTasks(tasks: Pick<DependencyTask, "id" | "dependencies" | "status">[], completedIds: Set<string>): string[];
/**
 * Validate dependency references.
 *
 * @param tasks - Tasks to validate
 * @returns Array of warning messages for invalid references
 */
export declare function validateDependencies(tasks: Pick<DependencyTask, "id" | "dependencies">[]): string[];
