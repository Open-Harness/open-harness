/**
 * Data Source Interface - Abstract interface for workflow data sources
 *
 * Enables pluggable data backends (JSON files, databases, APIs).
 */

import type { ProgressStats, TaskStatus } from "../schemas/task.js";

/**
 * Generic data source interface for workflow tasks
 */
export interface DataSource<T extends { id: string; status: TaskStatus }> {
	/**
	 * Check if the data source exists/is accessible
	 */
	exists(): boolean;

	/**
	 * Load all items from the data source
	 */
	load(): Promise<T[]>;

	/**
	 * Save all items to the data source
	 */
	save(items: T[]): Promise<void>;

	/**
	 * Get the next item matching filter criteria
	 */
	getNext(filter?: Partial<T>): Promise<T | null>;

	/**
	 * Mark an item as in progress
	 */
	markInProgress(id: string): Promise<void>;

	/**
	 * Mark an item as complete with optional result data
	 */
	markComplete(id: string, result?: Record<string, unknown>): Promise<void>;

	/**
	 * Mark an item as failed with error message
	 */
	markFailed(id: string, error: string): Promise<void>;

	/**
	 * Get progress statistics
	 */
	getProgress(): Promise<ProgressStats>;
}
