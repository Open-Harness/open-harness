/**
 * TaskList - Stateful task management primitive for workflows
 *
 * Manages task lifecycle: pending -> in_progress -> completed/failed
 * Tracks progress, provides history, and supports task metadata
 */

// ============================================
// Types
// ============================================

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export type Task<TResult = unknown, TMeta = Record<string, unknown>> = {
	/** Unique task identifier */
	id: string;
	/** Task description */
	description: string;
	/** Current status */
	status: TaskStatus;
	/** Optional metadata */
	metadata?: TMeta;
	/** Timestamp when task was created */
	createdAt: Date;
	/** Timestamp when task was started */
	startedAt?: Date;
	/** Timestamp when task was completed/failed */
	completedAt?: Date;
	/** Error message if failed */
	error?: string;
	/** Result data if completed */
	result?: TResult;
};

export type TaskProgress = {
	total: number;
	pending: number;
	in_progress: number;
	completed: number;
	failed: number;
	skipped: number;
	percentComplete: number;
};

export type TaskInput<TMeta = Record<string, unknown>> = {
	id: string;
	description: string;
	metadata?: TMeta;
};

// ============================================
// TaskList Class
// ============================================

export class TaskList<TResult = unknown, TMeta = Record<string, unknown>> {
	private tasks: Map<string, Task<TResult, TMeta>> = new Map();
	private history: Array<{ taskId: string; from: TaskStatus; to: TaskStatus; timestamp: Date }> = [];

	constructor(tasks?: TaskInput<TMeta>[]) {
		if (tasks) {
			for (const task of tasks) {
				this.add(task);
			}
		}
	}

	// ============================================
	// Task Management
	// ============================================

	/**
	 * Add a new task to the list
	 */
	add(input: TaskInput<TMeta>): Task<TResult, TMeta> {
		const task: Task<TResult, TMeta> = {
			...input,
			status: "pending",
			createdAt: new Date(),
		};
		this.tasks.set(task.id, task);
		return task;
	}

	/**
	 * Get a task by ID
	 */
	get(id: string): Task<TResult, TMeta> | undefined {
		return this.tasks.get(id);
	}

	/**
	 * Get all tasks
	 */
	getAll(): Task<TResult, TMeta>[] {
		return Array.from(this.tasks.values());
	}

	/**
	 * Get tasks by status
	 */
	getByStatus(status: TaskStatus): Task<TResult, TMeta>[] {
		return this.getAll().filter((t) => t.status === status);
	}

	// ============================================
	// Status Updates
	// ============================================

	/**
	 * Mark task as in progress
	 */
	markInProgress(id: string): Task<TResult, TMeta> {
		return this.updateStatus(id, "in_progress", { startedAt: new Date() });
	}

	/**
	 * Mark task as completed
	 */
	markCompleted(id: string, result?: TResult): Task<TResult, TMeta> {
		return this.updateStatus(id, "completed", {
			completedAt: new Date(),
			result,
		});
	}

	/**
	 * Mark task as failed
	 */
	markFailed(id: string, error: string): Task<TResult, TMeta> {
		return this.updateStatus(id, "failed", {
			completedAt: new Date(),
			error,
		});
	}

	/**
	 * Mark task as skipped
	 */
	markSkipped(id: string): Task<TResult, TMeta> {
		return this.updateStatus(id, "skipped", {
			completedAt: new Date(),
		});
	}

	/**
	 * Reset task to pending
	 */
	reset(id: string): Task<TResult, TMeta> {
		return this.updateStatus(id, "pending", {
			startedAt: undefined,
			completedAt: undefined,
			error: undefined,
			result: undefined,
		});
	}

	private updateStatus(
		id: string,
		newStatus: TaskStatus,
		updates: Partial<Task<TResult, TMeta>> = {},
	): Task<TResult, TMeta> {
		const task = this.tasks.get(id);
		if (!task) {
			throw new Error(`Task not found: ${id}`);
		}

		const oldStatus = task.status;
		const updatedTask = { ...task, ...updates, status: newStatus };
		this.tasks.set(id, updatedTask);

		// Record history
		this.history.push({
			taskId: id,
			from: oldStatus,
			to: newStatus,
			timestamp: new Date(),
		});

		return updatedTask;
	}

	// ============================================
	// Progress Tracking
	// ============================================

	/**
	 * Get progress statistics
	 */
	getProgress(): TaskProgress {
		const all = this.getAll();
		const total = all.length;
		const pending = all.filter((t) => t.status === "pending").length;
		const in_progress = all.filter((t) => t.status === "in_progress").length;
		const completed = all.filter((t) => t.status === "completed").length;
		const failed = all.filter((t) => t.status === "failed").length;
		const skipped = all.filter((t) => t.status === "skipped").length;

		const percentComplete = total > 0 ? Math.round(((completed + skipped) / total) * 100) : 0;

		return {
			total,
			pending,
			in_progress,
			completed,
			failed,
			skipped,
			percentComplete,
		};
	}

	/**
	 * Get task history
	 */
	getHistory(): typeof this.history {
		return [...this.history];
	}

	/**
	 * Check if all tasks are complete (completed or skipped)
	 */
	isComplete(): boolean {
		const progress = this.getProgress();
		return progress.total > 0 && progress.pending === 0 && progress.in_progress === 0;
	}

	/**
	 * Check if any tasks have failed
	 */
	hasFailed(): boolean {
		return this.getProgress().failed > 0;
	}

	// ============================================
	// Utilities
	// ============================================

	/**
	 * Clear all tasks
	 */
	clear(): void {
		this.tasks.clear();
		this.history = [];
	}

	/**
	 * Get summary string
	 */
	toString(): string {
		const progress = this.getProgress();
		return `TaskList: ${progress.completed}/${progress.total} completed (${progress.percentComplete}%)`;
	}
}
