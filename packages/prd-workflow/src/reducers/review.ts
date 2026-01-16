/**
 * Review Layer Reducers
 *
 * Handle review signals for tasks and milestones.
 */

import type { SignalReducer } from "@internal/core";
import type { ReviewDecisionOutput } from "../schemas.js";
import type { PRDWorkflowState } from "../types.js";
import { createSignal } from "./utils.js";

/**
 * Handle task:approved signal.
 * Marks task complete and checks for milestone completion.
 */
export const taskApprovedReducer: SignalReducer<PRDWorkflowState> = (state, signal, ctx) => {
	// The output from harness contains { content, sessionId, usage, structuredOutput }
	const harnessOutput = (signal.payload as { output: { structuredOutput?: ReviewDecisionOutput } }).output;
	const decision = harnessOutput.structuredOutput;
	const taskId = state.review.taskUnderReview;
	if (!taskId || !decision) return;

	const task = state.planning.allTasks[taskId];
	if (!task) return;

	task.status = "complete";
	state.execution.completedTaskIds.push(taskId);
	state.execution.currentTaskId = null;
	state.execution.currentTask = null;
	state.review.taskUnderReview = null;
	state.review.currentTaskForReview = null;
	state.review.lastDecision = {
		decision: "approved",
		reasoning: decision.reasoning,
		fixInstructions: null,
		specificIssues: [],
		escalationReason: null,
		recommendedAction: null,
		progressMade: decision.progressMade,
		lessonsLearned: decision.lessonsLearned,
	};

	// Update attempt history with feedback
	const lastAttempt = task.attemptHistory[task.attemptHistory.length - 1];
	if (lastAttempt) {
		lastAttempt.reviewFeedback = decision.reasoning;
	}

	state.history.push({
		timestamp: new Date().toISOString(),
		type: "task_completed",
		details: {
			taskId,
			attempt: task.attempt,
			lessonsLearned: decision.lessonsLearned,
		},
	});

	// Check if dependencies are now resolved for any pending tasks
	for (const [id, t] of Object.entries(state.planning.allTasks)) {
		if (t.status === "pending" && t.dependencies.includes(taskId)) {
			// Check if all dependencies are now complete
			const allDepsComplete = t.dependencies.every((depId) => {
				const dep = state.planning.allTasks[depId];
				return dep && dep.status === "complete";
			});
			if (allDepsComplete) {
				t.status = "ready";
				state.planning.taskQueue.push(id);
			}
		}
	}

	// Check if milestone is testable
	const milestone = state.planning.milestones.find((m) => m.id === task.milestoneId);
	if (milestone) {
		const allTasksComplete = milestone.taskIds.every((tid) => {
			const t = state.planning.allTasks[tid];
			return t && (t.status === "complete" || t.status === "skipped");
		});

		if (allTasksComplete) {
			state.review.phase = "reviewing_milestone";
			state.review.milestoneUnderReview = milestone.id;
			milestone.status = "testing";
			// Emit milestone:testable to trigger acceptance test
			ctx.emit(createSignal("milestone:testable", { milestoneId: milestone.id }));
		} else {
			// Queue next ready task
			state.review.phase = "idle";
			state.execution.phase = "idle";
			// Emit task:ready for next task if queue not empty
			if (state.planning.taskQueue.length > 0) {
				ctx.emit(createSignal("task:ready", { taskId: state.planning.taskQueue[0] }));
			}
		}
	}
};

/**
 * Handle task:needs_fix signal.
 * Updates history and triggers another coding attempt.
 */
export const taskNeedsFixReducer: SignalReducer<PRDWorkflowState> = (state, signal, ctx) => {
	// The output from harness contains { content, sessionId, usage, structuredOutput }
	const harnessOutput = (signal.payload as { output: { structuredOutput?: ReviewDecisionOutput } }).output;
	const decision = harnessOutput.structuredOutput;
	const taskId = state.review.taskUnderReview;
	if (!taskId || !decision) return;

	const task = state.planning.allTasks[taskId];
	if (!task) return;

	// Update attempt history with feedback
	const lastAttempt = task.attemptHistory[task.attemptHistory.length - 1];
	if (lastAttempt) {
		lastAttempt.outcome = "failed";
		lastAttempt.reviewFeedback = decision.fixInstructions;
	}

	state.review.taskUnderReview = null;
	state.review.currentTaskForReview = null;
	state.review.lastDecision = {
		decision: "needs_fix",
		reasoning: decision.reasoning,
		fixInstructions: decision.fixInstructions,
		specificIssues: decision.specificIssues,
		escalationReason: null,
		recommendedAction: null,
		progressMade: decision.progressMade,
		lessonsLearned: decision.lessonsLearned,
	};
	state.review.phase = "idle";

	// Task stays in_progress, will be retried
	state.execution.phase = "executing";

	state.history.push({
		timestamp: new Date().toISOString(),
		type: "task_failed",
		details: {
			taskId,
			attempt: task.attempt,
			reason: decision.reasoning,
			progressMade: decision.progressMade,
		},
	});

	// Emit fix:required to trigger coding agent retry
	ctx.emit(
		createSignal("fix:required", {
			taskId,
			fixInstructions: decision.fixInstructions,
			specificIssues: decision.specificIssues,
		}),
	);
};

/**
 * Handle task:escalate signal.
 * Handles skip, replan, or abort based on recommendation.
 */
export const taskEscalateReducer: SignalReducer<PRDWorkflowState> = (state, signal, ctx) => {
	// The output from harness contains { content, sessionId, usage, structuredOutput }
	const harnessOutput = (signal.payload as { output: { structuredOutput?: ReviewDecisionOutput } }).output;
	const decision = harnessOutput.structuredOutput;
	const taskId = state.review.taskUnderReview;
	if (!taskId || !decision) return;

	const task = state.planning.allTasks[taskId];

	state.review.taskUnderReview = null;
	state.review.currentTaskForReview = null;
	state.review.lastDecision = {
		decision: "escalate",
		reasoning: decision.reasoning,
		fixInstructions: null,
		specificIssues: [],
		escalationReason: decision.escalationReason,
		recommendedAction: decision.recommendedAction,
		progressMade: decision.progressMade,
		lessonsLearned: decision.lessonsLearned,
	};

	if (decision.recommendedAction === "skip") {
		if (task) {
			task.status = "skipped";
		}
		state.execution.skippedTaskIds.push(taskId);
		state.execution.currentTaskId = null;
		state.execution.currentTask = null;

		state.history.push({
			timestamp: new Date().toISOString(),
			type: "task_skipped",
			details: { taskId, reason: decision.escalationReason },
		});

		// Check if milestone can still proceed
		const milestone = state.planning.milestones.find((m) => m.id === task?.milestoneId);
		if (milestone) {
			const allTasksDone = milestone.taskIds.every((tid) => {
				const t = state.planning.allTasks[tid];
				return t && (t.status === "complete" || t.status === "skipped");
			});

			if (allTasksDone) {
				state.review.phase = "reviewing_milestone";
				state.review.milestoneUnderReview = milestone.id;
				milestone.status = "testing";
				ctx.emit(createSignal("milestone:testable", { milestoneId: milestone.id }));
			} else if (state.planning.taskQueue.length > 0) {
				state.review.phase = "idle";
				state.execution.phase = "idle";
				ctx.emit(createSignal("task:ready", { taskId: state.planning.taskQueue[0] }));
			}
		}
	} else if (decision.recommendedAction === "replan") {
		state.planning.replanCount++;

		if (state.planning.replanCount > state.planning.maxReplans) {
			state.workflowPhase = "failed";
			state.terminalFailure = "Exceeded maximum replan attempts";
			state.history.push({
				timestamp: new Date().toISOString(),
				type: "workflow_failed",
				details: { reason: state.terminalFailure },
			});
		} else {
			state.planning.phase = "replanning";
			state.execution.currentTaskId = null;
			state.execution.currentTask = null;

			state.history.push({
				timestamp: new Date().toISOString(),
				type: "replan_triggered",
				details: {
					taskId,
					replanCount: state.planning.replanCount,
					reason: decision.escalationReason,
				},
			});

			// Emit replan:requested to trigger planning agent
			ctx.emit(
				createSignal("replan:requested", {
					reason: decision.escalationReason,
					taskId,
				}),
			);
		}
	} else if (decision.recommendedAction === "abort") {
		state.workflowPhase = "failed";
		state.terminalFailure = decision.escalationReason;
		state.execution.currentTaskId = null;
		state.execution.currentTask = null;

		state.history.push({
			timestamp: new Date().toISOString(),
			type: "workflow_failed",
			details: { reason: decision.escalationReason },
		});
	}
};

/**
 * Handle milestone:complete signal.
 * Checks if all milestones are done or queues next milestone.
 */
export const milestoneCompleteReducer: SignalReducer<PRDWorkflowState> = (state, signal, ctx) => {
	const milestoneId = state.review.milestoneUnderReview;
	if (!milestoneId) return;

	const milestone = state.planning.milestones.find((m) => m.id === milestoneId);
	if (!milestone) return;

	milestone.status = "complete";
	state.review.milestoneUnderReview = null;
	state.review.phase = "idle";

	state.history.push({
		timestamp: new Date().toISOString(),
		type: "milestone_completed",
		details: { milestoneId },
	});

	// Check if all milestones complete
	const allComplete = state.planning.milestones.every((m) => m.status === "complete");

	if (allComplete) {
		state.workflowPhase = "complete";
		state.history.push({
			timestamp: new Date().toISOString(),
			type: "workflow_complete",
			details: {},
		});
	} else {
		// Queue next milestone's tasks
		const nextMilestone = state.planning.milestones.find((m) => m.status === "pending");
		if (nextMilestone) {
			// Check if dependencies are met
			const depsComplete = nextMilestone.dependencies.every((depId) => {
				const dep = state.planning.milestones.find((m) => m.id === depId);
				return dep && dep.status === "complete";
			});

			if (depsComplete) {
				nextMilestone.status = "in_progress";
				state.execution.currentMilestoneId = nextMilestone.id;

				for (const taskId of nextMilestone.taskIds) {
					const task = state.planning.allTasks[taskId];
					if (task && task.dependencies.length === 0) {
						task.status = "ready";
						state.planning.taskQueue.push(taskId);
					}
				}

				// Emit task:ready for first task
				if (state.planning.taskQueue.length > 0) {
					ctx.emit(createSignal("task:ready", { taskId: state.planning.taskQueue[0] }));
				}
			}
		}
	}
};

/**
 * Handle milestone:failed signal.
 * Triggers replan if not at max.
 */
export const milestoneFailedReducer: SignalReducer<PRDWorkflowState> = (state, signal, ctx) => {
	// The output from harness contains { content, sessionId, usage, structuredOutput }
	const harnessOutput = (signal.payload as { output?: { structuredOutput?: ReviewDecisionOutput } }).output;
	const decision = harnessOutput?.structuredOutput;
	const milestoneId = state.review.milestoneUnderReview;
	if (!milestoneId) return;

	const milestone = state.planning.milestones.find((m) => m.id === milestoneId);
	if (!milestone) return;

	milestone.status = "failed";
	state.review.milestoneUnderReview = null;

	state.history.push({
		timestamp: new Date().toISOString(),
		type: "milestone_failed",
		details: { milestoneId, reason: decision?.reasoning },
	});

	// Trigger replan
	state.planning.replanCount++;

	if (state.planning.replanCount > state.planning.maxReplans) {
		state.workflowPhase = "failed";
		state.terminalFailure = "Milestone acceptance test failed after max replans";
		state.history.push({
			timestamp: new Date().toISOString(),
			type: "workflow_failed",
			details: { reason: state.terminalFailure },
		});
	} else {
		state.planning.phase = "replanning";

		state.history.push({
			timestamp: new Date().toISOString(),
			type: "replan_triggered",
			details: {
				milestoneId,
				replanCount: state.planning.replanCount,
				reason: decision?.reasoning,
			},
		});

		ctx.emit(
			createSignal("replan:requested", {
				reason: `Milestone ${milestone.title} acceptance test failed`,
				milestoneId,
			}),
		);
	}
};
