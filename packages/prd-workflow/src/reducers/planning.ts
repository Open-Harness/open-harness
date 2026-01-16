/**
 * Planning Layer Reducers
 *
 * Handle plan creation and discovery processing signals.
 */

import type { ReducerContext, SignalReducer } from "@internal/core";
import type { Signal } from "@internal/signals-core";
import type { DiscoveryDecision, PlanOutput } from "../schemas.js";
import type { DiscoveredTask, Milestone, PRDWorkflowState, Task } from "../types.js";
import { createSignal } from "./utils.js";

/**
 * Handle plan:created signal.
 * Builds milestones and tasks from plan output, queues first tasks.
 */
export const planCreatedReducer: SignalReducer<PRDWorkflowState> = (state, signal, ctx) => {
	// The output from harness contains { content, sessionId, usage, structuredOutput }
	// When using a schema, the parsed output is in structuredOutput
	const harnessOutput = (signal.payload as { output: { structuredOutput?: PlanOutput } }).output;
	const plan = harnessOutput.structuredOutput;

	if (!plan) {
		// No structured output available, workflow cannot proceed
		state.terminalFailure = "Plan agent did not return structured output";
		state.workflowPhase = "failed";
		return;
	}

	// Build milestones with IDs
	state.planning.milestones = plan.milestones.map((m, idx) => ({
		id: `M${String(idx + 1).padStart(3, "0")}`,
		index: idx,
		title: m.title,
		description: m.description,
		acceptanceTest: m.acceptanceTest,
		taskIds: [], // Filled below
		dependencies: [], // Resolve from titles to IDs later
		status: "pending" as const,
	}));

	// Build mapping from milestone titles to IDs for dependency resolution
	const milestoneTitleToId = new Map<string, string>();
	for (const [idx, spec] of plan.milestones.entries()) {
		const milestone = state.planning.milestones[idx];
		if (milestone) {
			milestoneTitleToId.set(spec.title, milestone.id);
		}
	}

	// Build tasks with IDs
	let taskCounter = 1;
	const taskTitleToId = new Map<string, string>();

	for (const [mIdx, milestoneSpec] of plan.milestones.entries()) {
		const milestone = state.planning.milestones[mIdx];
		if (!milestone) continue;

		for (const taskSpec of milestoneSpec.tasks) {
			const taskId = `T${String(taskCounter++).padStart(3, "0")}`;
			taskTitleToId.set(taskSpec.title, taskId);

			const task: Task = {
				id: taskId,
				milestoneId: milestone.id,
				title: taskSpec.title,
				description: taskSpec.description,
				definitionOfDone: taskSpec.definitionOfDone,
				technicalApproach: taskSpec.technicalApproach,
				filesToModify: taskSpec.filesToModify,
				filesToCreate: taskSpec.filesToCreate,
				changes: taskSpec.changes,
				context: taskSpec.context,
				dependencies: [], // Resolve from titles to IDs below
				blockedBy: null,
				status: "pending",
				createdBy: "planner",
				attempt: 0,
				maxAttempts: 5,
				attemptHistory: [],
			};

			state.planning.allTasks[taskId] = task;
			milestone.taskIds.push(taskId);
		}
	}

	// Resolve task dependencies (titles to IDs)
	for (const [mIdx, milestoneSpec] of plan.milestones.entries()) {
		for (const [tIdx, taskSpec] of milestoneSpec.tasks.entries()) {
			const milestone = state.planning.milestones[mIdx];
			if (!milestone) continue;
			const taskId = milestone.taskIds[tIdx];
			if (!taskId) continue;
			const task = state.planning.allTasks[taskId];
			if (!task) continue;

			task.dependencies = taskSpec.dependencies
				.map((title) => taskTitleToId.get(title))
				.filter((id): id is string => id !== undefined);
		}
	}

	// Resolve milestone dependencies (titles to IDs)
	for (const [mIdx, milestoneSpec] of plan.milestones.entries()) {
		const milestone = state.planning.milestones[mIdx];
		if (!milestone) continue;

		milestone.dependencies = milestoneSpec.dependencies
			.map((title) => milestoneTitleToId.get(title))
			.filter((id): id is string => id !== undefined);
	}

	// Queue first milestone's tasks that have no dependencies
	const firstMilestone = state.planning.milestones[0];
	if (firstMilestone) {
		firstMilestone.status = "in_progress";
		state.execution.currentMilestoneId = firstMilestone.id;

		for (const taskId of firstMilestone.taskIds) {
			const task = state.planning.allTasks[taskId];
			if (task && task.dependencies.length === 0) {
				task.status = "ready";
				state.planning.taskQueue.push(taskId);
			}
		}
	}

	state.planning.phase = "monitoring";
	state.planning.approach = plan.approach;
	state.planning.reasoning = plan.reasoning;
	state.workflowPhase = "executing";

	// Emit task:ready to start execution
	if (state.planning.taskQueue.length > 0) {
		ctx.emit(createSignal("task:ready", { taskId: state.planning.taskQueue[0] }));
	}
};

/**
 * Handle tasks:queued signal.
 * Additional tasks added to queue (e.g., after dependencies resolve).
 */
export const tasksQueuedReducer: SignalReducer<PRDWorkflowState> = (state, signal, ctx) => {
	const taskIds = (signal.payload as { taskIds: string[] }).taskIds;
	for (const taskId of taskIds) {
		if (!state.planning.taskQueue.includes(taskId)) {
			const task = state.planning.allTasks[taskId];
			if (task) {
				task.status = "ready";
				state.planning.taskQueue.push(taskId);
			}
		}
	}
};

/**
 * Handle discovery:submitted signal.
 * Adds discovered tasks to pending list for planner review.
 */
export const discoverySubmittedReducer: SignalReducer<PRDWorkflowState> = (state, signal, _ctx) => {
	const discoveries = (signal.payload as { discoveries: DiscoveredTask[] }).discoveries;
	state.planning.pendingDiscoveries.push(...discoveries);
	state.planning.phase = "monitoring"; // Planner will process
};

/**
 * Handle discovery:processed signal.
 * Creates tasks from approved discoveries and queues them.
 */
export const discoveryProcessedReducer: SignalReducer<PRDWorkflowState> = (state, signal, ctx) => {
	// The output from harness contains { content, sessionId, usage, structuredOutput }
	const harnessOutput = (signal.payload as { output: { structuredOutput?: DiscoveryDecision } }).output;
	const decisions = harnessOutput.structuredOutput;

	if (!decisions) return;

	for (const decision of decisions.decisions) {
		const discovery = state.planning.pendingDiscoveries.find((d) => d.title === decision.discoveredTaskTitle);

		if (!discovery) continue;

		if (decision.approved) {
			// Create new task from discovery
			const existingTaskCount = Object.keys(state.planning.allTasks).length;
			const taskId = `T${String(existingTaskCount + 1).padStart(3, "0")}-disc`;
			const milestoneId = decision.assignedMilestoneId || discovery.suggestedMilestoneId;

			if (!milestoneId) {
				// Can't create task without milestone
				state.planning.rejectedDiscoveries.push(discovery);
				continue;
			}

			const task: Task = {
				id: taskId,
				milestoneId,
				title: decision.modifications?.title || discovery.title,
				description: discovery.description,
				definitionOfDone: decision.modifications?.definitionOfDone || discovery.definitionOfDone,
				technicalApproach: null,
				filesToModify: discovery.filesToModify,
				filesToCreate: discovery.filesToCreate,
				changes: discovery.changes,
				context: discovery.reason,
				dependencies: decision.modifications?.dependencies || [],
				blockedBy: null,
				status: "pending",
				createdBy: "coder",
				attempt: 0,
				maxAttempts: 5,
				attemptHistory: [],
			};

			state.planning.allTasks[taskId] = task;

			// Add to milestone
			const milestone = state.planning.milestones.find((m) => m.id === milestoneId);
			if (milestone) {
				milestone.taskIds.push(taskId);
			}

			// Queue if no dependencies
			if (task.dependencies.length === 0) {
				task.status = "ready";
				state.planning.taskQueue.push(taskId);
			}

			state.history.push({
				timestamp: new Date().toISOString(),
				type: "discovery_approved",
				details: { taskId, title: task.title },
			});
		} else {
			state.planning.rejectedDiscoveries.push(discovery);
			state.history.push({
				timestamp: new Date().toISOString(),
				type: "discovery_rejected",
				details: { title: discovery.title, reason: decision.reason },
			});
		}
	}

	// Clear processed discoveries
	state.planning.pendingDiscoveries = [];

	// Emit task:ready if tasks were queued and no task is currently in progress
	if (state.planning.taskQueue.length > 0 && state.execution.phase === "idle") {
		ctx.emit(createSignal("task:ready", { taskId: state.planning.taskQueue[0] }));
	}
};
