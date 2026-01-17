/**
 * Execution Layer Reducers
 *
 * Handle task execution signals.
 */

import type { SignalReducer } from "@internal/core";
import type { TaskResult } from "../schemas.js";
import type { DiscoveredTask, PRDWorkflowState } from "../types.js";
import { createSignal } from "./utils.js";

/**
 * Handle task:ready signal.
 * Picks next task from queue and sets it as current.
 */
export const taskReadyReducer: SignalReducer<PRDWorkflowState> = (state, _signal, _ctx) => {
	// Pick next task from queue
	if (state.planning.taskQueue.length > 0) {
		const taskId = state.planning.taskQueue.shift()!;
		state.execution.currentTaskId = taskId;
		state.execution.phase = "executing";

		const task = state.planning.allTasks[taskId];
		if (task) {
			task.status = "in_progress";
			task.attempt++;

			// Pre-compute for template access (avoids need for bracket notation)
			state.execution.currentTask = task;

			state.history.push({
				timestamp: new Date().toISOString(),
				type: "task_started",
				details: { taskId, attempt: task.attempt },
			});
		}
	}
};

/**
 * Handle task:complete signal.
 * Records attempt and moves to review.
 */
export const taskCompleteReducer: SignalReducer<PRDWorkflowState> = (state, signal, ctx) => {
	// The output from harness contains { content, sessionId, usage, structuredOutput }
	const harnessOutput = (signal.payload as { output: { structuredOutput?: TaskResult } }).output;
	const result = harnessOutput.structuredOutput;
	const taskId = state.execution.currentTaskId;
	if (!taskId || !result) return;

	const task = state.planning.allTasks[taskId];
	if (!task) return;

	// Record attempt
	task.attemptHistory.push({
		attempt: task.attempt,
		timestamp: new Date().toISOString(),
		outcome: result.status === "complete" ? "success" : "blocked",
		summary: result.summary,
		filesChanged: result.filesChanged,
		checkpointHash: result.checkpointName,
		reviewFeedback: null, // Filled by reviewer
	});

	// Handle discovered tasks
	if (result.discoveredTasks.length > 0) {
		const discoveries: DiscoveredTask[] = result.discoveredTasks.map((d) => ({
			...d,
			discoveredBy: taskId,
			timestamp: new Date().toISOString(),
		}));
		state.planning.pendingDiscoveries.push(...discoveries);

		// Emit discovery:submitted for each batch
		ctx.emit(createSignal("discovery:submitted", { discoveries }));
	}

	// Move to review
	state.execution.phase = "awaiting_review";
	state.review.phase = "reviewing_task";
	state.review.taskUnderReview = taskId;
	// Pre-compute for template access
	state.review.currentTaskForReview = task;
};

/**
 * Handle task:blocked signal.
 * Marks task as blocked and moves to next task.
 */
export const taskBlockedReducer: SignalReducer<PRDWorkflowState> = (state, signal, ctx) => {
	// The output from harness contains { content, sessionId, usage, structuredOutput }
	const harnessOutput = (signal.payload as { output: { structuredOutput?: TaskResult } }).output;
	const result = harnessOutput.structuredOutput;
	const taskId = state.execution.currentTaskId;
	if (!taskId || !result) return;

	const task = state.planning.allTasks[taskId];
	if (task) {
		task.status = "blocked";
		task.blockedBy = result.blockedBy;

		// Record attempt as blocked
		task.attemptHistory.push({
			attempt: task.attempt,
			timestamp: new Date().toISOString(),
			outcome: "blocked",
			summary: result.summary,
			filesChanged: result.filesChanged,
			checkpointHash: result.checkpointName,
			reviewFeedback: result.blockedReason,
		});
	}

	state.execution.blockedTaskIds.push(taskId);
	state.execution.currentTaskId = null;
	state.execution.currentTask = null;

	state.history.push({
		timestamp: new Date().toISOString(),
		type: "task_failed",
		details: { taskId, reason: result.blockedReason },
	});

	// Try to pick up next task
	if (state.planning.taskQueue.length > 0) {
		ctx.emit(createSignal("task:ready", { taskId: state.planning.taskQueue[0] }));
	} else {
		state.execution.phase = "idle";
	}
};

/**
 * Handle fix:required signal.
 * Sets up the task for another attempt with fix instructions.
 */
export const fixRequiredReducer: SignalReducer<PRDWorkflowState> = (state, signal, _ctx) => {
	const { taskId, fixInstructions, specificIssues } = signal.payload as {
		taskId: string;
		fixInstructions: string;
		specificIssues: unknown[];
	};

	const task = state.planning.allTasks[taskId];
	if (!task) return;

	// Task stays in_progress, will be retried
	// The coding agent will see the fix instructions in state
	state.execution.phase = "executing";
	state.execution.currentTaskId = taskId;
	state.execution.currentTask = task;

	// Update the last attempt with the fix instructions
	const lastAttempt = task.attemptHistory[task.attemptHistory.length - 1];
	if (lastAttempt) {
		lastAttempt.reviewFeedback = fixInstructions;
	}
};
