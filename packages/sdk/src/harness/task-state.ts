/**
 * TaskHarnessState Management
 *
 * Manages the state of task execution including:
 * - Task queue and current task tracking
 * - Completed, validated, and failed task records
 * - Retry history for failed tasks
 *
 * @module harness/task-state
 */

import type {
	FailureRecord,
	NarrativeEntry,
	ParsedTask,
	RetryRecord,
	TaskHarnessConfig,
	TaskHarnessState,
	TaskResult,
	ValidationResult,
} from "./task-harness-types.js";

/**
 * Create initial harness state from config and parsed tasks.
 *
 * @param config - Harness configuration
 * @param tasks - Parsed tasks (empty until parser runs)
 * @param taskQueue - Initial task queue (topologically sorted)
 * @returns Initial TaskHarnessState
 */
export function createInitialState(
	config: TaskHarnessConfig,
	tasks: ParsedTask[] = [],
	taskQueue: string[] = [],
): TaskHarnessState {
	return {
		tasks,
		taskQueue,
		currentTaskId: null,
		completedTasks: {},
		validatedTasks: {},
		failedTasks: {},
		retryHistory: {},
		mode: config.mode,
		continueOnFailure: config.continueOnFailure ?? false,
		sessionId: config.sessionId ?? generateSessionId(),
	};
}

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return `harness-${timestamp}-${random}`;
}

/**
 * State transition: Start a task.
 */
export function startTask(state: TaskHarnessState, taskId: string): TaskHarnessState {
	return {
		...state,
		currentTaskId: taskId,
	};
}

/**
 * State transition: Complete a task (coding done, not validated yet).
 */
export function completeTask(state: TaskHarnessState, taskId: string, result: TaskResult): TaskHarnessState {
	return {
		...state,
		completedTasks: {
			...state.completedTasks,
			[taskId]: result,
		},
	};
}

/**
 * State transition: Validate a task (review passed).
 */
export function validateTask(state: TaskHarnessState, taskId: string, result: ValidationResult): TaskHarnessState {
	// Remove from task queue
	const newQueue = state.taskQueue.filter((id) => id !== taskId);

	return {
		...state,
		taskQueue: newQueue,
		currentTaskId: null,
		validatedTasks: {
			...state.validatedTasks,
			[taskId]: result,
		},
	};
}

/**
 * State transition: Fail a task.
 */
export function failTask(state: TaskHarnessState, taskId: string, failure: FailureRecord): TaskHarnessState {
	// Remove from task queue if fail-fast
	const newQueue = state.continueOnFailure ? state.taskQueue : state.taskQueue.filter((id) => id !== taskId);

	return {
		...state,
		taskQueue: newQueue,
		currentTaskId: null,
		failedTasks: {
			...state.failedTasks,
			[taskId]: failure,
		},
	};
}

/**
 * State transition: Record a retry attempt.
 */
export function recordRetry(state: TaskHarnessState, taskId: string, retry: RetryRecord): TaskHarnessState {
	const existing = state.retryHistory[taskId] ?? [];

	return {
		...state,
		retryHistory: {
			...state.retryHistory,
			[taskId]: [...existing, retry],
		},
	};
}

/**
 * State transition: Set tasks after parsing.
 */
export function setTasks(state: TaskHarnessState, tasks: ParsedTask[], taskQueue: string[]): TaskHarnessState {
	return {
		...state,
		tasks,
		taskQueue,
	};
}

/**
 * Get the next pending task from the queue.
 *
 * @param state - Current harness state
 * @returns Next task ID or null if queue is empty
 */
export function getNextTask(state: TaskHarnessState): string | null {
	if (state.taskQueue.length === 0) {
		return null;
	}

	// Find first task that hasn't been validated or failed
	for (const taskId of state.taskQueue) {
		if (!state.validatedTasks[taskId] && !state.failedTasks[taskId]) {
			return taskId;
		}
	}

	return null;
}

/**
 * Get task by ID from state.
 */
export function getTask(state: TaskHarnessState, taskId: string): ParsedTask | undefined {
	return state.tasks.find((t) => t.id === taskId);
}

/**
 * Check if harness execution is complete.
 *
 * @param state - Current harness state
 * @returns True if all tasks processed or stopped due to failure
 */
export function isComplete(state: TaskHarnessState): boolean {
	// No more tasks in queue
	if (state.taskQueue.length === 0) {
		return true;
	}

	// All remaining tasks are either validated or failed
	const remaining = state.taskQueue.filter((id) => !state.validatedTasks[id] && !state.failedTasks[id]);

	// If not continuing on failure and we have a failed task, we're done
	if (!state.continueOnFailure && Object.keys(state.failedTasks).length > 0) {
		return true;
	}

	return remaining.length === 0;
}

/**
 * Get retry count for a task.
 */
export function getRetryCount(state: TaskHarnessState, taskId: string): number {
	return state.retryHistory[taskId]?.length ?? 0;
}

/**
 * Create a narrative entry.
 */
export function createNarrativeEntry(
	agentName: NarrativeEntry["agentName"],
	text: string,
	taskId: string | null = null,
): NarrativeEntry {
	return {
		timestamp: Date.now(),
		agentName,
		taskId,
		text,
	};
}
