/**
 * TaskList - Stateful task management primitive for workflows
 *
 * Manages task lifecycle: pending -> in_progress -> completed/failed
 * Tracks progress, provides history, and supports task metadata
 */
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
export declare class TaskList<TResult = unknown, TMeta = Record<string, unknown>> {
    private tasks;
    private history;
    constructor(tasks?: TaskInput<TMeta>[]);
    /**
     * Add a new task to the list
     */
    add(input: TaskInput<TMeta>): Task<TResult, TMeta>;
    /**
     * Get a task by ID
     */
    get(id: string): Task<TResult, TMeta> | undefined;
    /**
     * Get all tasks
     */
    getAll(): Task<TResult, TMeta>[];
    /**
     * Get tasks by status
     */
    getByStatus(status: TaskStatus): Task<TResult, TMeta>[];
    /**
     * Mark task as in progress
     */
    markInProgress(id: string): Task<TResult, TMeta>;
    /**
     * Mark task as completed
     */
    markCompleted(id: string, result?: TResult): Task<TResult, TMeta>;
    /**
     * Mark task as failed
     */
    markFailed(id: string, error: string): Task<TResult, TMeta>;
    /**
     * Mark task as skipped
     */
    markSkipped(id: string): Task<TResult, TMeta>;
    /**
     * Reset task to pending
     */
    reset(id: string): Task<TResult, TMeta>;
    private updateStatus;
    /**
     * Get progress statistics
     */
    getProgress(): TaskProgress;
    /**
     * Get task history
     */
    getHistory(): typeof this.history;
    /**
     * Check if all tasks are complete (completed or skipped)
     */
    isComplete(): boolean;
    /**
     * Check if any tasks have failed
     */
    hasFailed(): boolean;
    /**
     * Clear all tasks
     */
    clear(): void;
    /**
     * Get summary string
     */
    toString(): string;
}
