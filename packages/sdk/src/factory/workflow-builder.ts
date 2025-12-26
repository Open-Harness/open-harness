/**
 * Workflow Builder - Creates workflows without exposing DI container
 *
 * Workflows orchestrate multiple agents with task management.
 * Users define the orchestration logic via an execute function.
 */

import type { IAgentCallbacks } from "../callbacks/types.js";
import type { BaseAnthropicAgent } from "../providers/anthropic/agents/base-anthropic-agent.js";
import { type Task, type TaskInput, TaskList } from "../workflow/task-list.js";

// ============================================
// Types
// ============================================

/**
 * Workflow state - passed to execute function
 */
export type WorkflowState<TResult = unknown, TMeta = Record<string, unknown>> = {
	/** Task list instance */
	tasks: TaskList<TResult, TMeta>;
	/** Mark task in progress */
	markInProgress: (taskId: string) => Task<TResult, TMeta>;
	/** Mark task complete */
	markComplete: (taskId: string, result?: TResult) => Task<TResult, TMeta>;
	/** Mark task failed */
	markFailed: (taskId: string, error: string) => Task<TResult, TMeta>;
	/** Mark task skipped */
	markSkipped: (taskId: string) => Task<TResult, TMeta>;
	/** Get progress */
	getProgress: () => ReturnType<TaskList<TResult, TMeta>["getProgress"]>;
	/** Check if complete */
	isComplete: () => boolean;
	/** Check if any failed */
	hasFailed: () => boolean;
	/** Workflow-level metadata */
	metadata: Record<string, unknown>;
};

/**
 * Context passed to workflow execute function
 */
export type WorkflowContext<
	TAgents extends Record<string, BaseAnthropicAgent> = Record<string, BaseAnthropicAgent>,
	TResult = unknown,
	TMeta = Record<string, unknown>,
> = {
	/** Available agents */
	agents: TAgents;
	/** Workflow state */
	state: WorkflowState<TResult, TMeta>;
	/** All tasks */
	tasks: Task<TResult, TMeta>[];
};

/**
 * Workflow configuration
 */
export type WorkflowConfig<
	TAgents extends Record<string, BaseAnthropicAgent> = Record<string, BaseAnthropicAgent>,
	TResult = unknown,
	TMeta = Record<string, unknown>,
> = {
	/** Workflow name */
	name: string;
	/** Task list */
	tasks: TaskInput<TMeta>[];
	/** Available agents (keyed by name) */
	agents: TAgents;
	/** Orchestration logic */
	execute: (context: WorkflowContext<TAgents, TResult, TMeta>) => Promise<void>;
	/** Optional: global callbacks */
	callbacks?: IAgentCallbacks;
	/** Optional: monologue configuration */
	monologue?: {
		enabled: boolean;
		onNarrative?: (text: string) => void;
	};
	/** Optional: initial metadata */
	metadata?: Record<string, unknown>;
};

// ============================================
// Workflow Class
// ============================================

export class Workflow<
	TAgents extends Record<string, BaseAnthropicAgent> = Record<string, BaseAnthropicAgent>,
	TResult = unknown,
	TMeta = Record<string, unknown>,
> {
	private taskList: TaskList<TResult, TMeta>;
	private state: WorkflowState<TResult, TMeta>;

	constructor(private config: WorkflowConfig<TAgents, TResult, TMeta>) {
		this.taskList = new TaskList<TResult, TMeta>(config.tasks);

		// Create workflow state
		this.state = {
			tasks: this.taskList,
			markInProgress: (taskId) => this.taskList.markInProgress(taskId),
			markComplete: (taskId, result) => this.taskList.markCompleted(taskId, result),
			markFailed: (taskId, error) => this.taskList.markFailed(taskId, error),
			markSkipped: (taskId) => this.taskList.markSkipped(taskId),
			getProgress: () => this.taskList.getProgress(),
			isComplete: () => this.taskList.isComplete(),
			hasFailed: () => this.taskList.hasFailed(),
			metadata: config.metadata || {},
		};
	}

	/**
	 * Run the workflow
	 */
	async run(): Promise<WorkflowState<TResult, TMeta>> {
		const context: WorkflowContext<TAgents, TResult, TMeta> = {
			agents: this.config.agents,
			state: this.state,
			tasks: this.taskList.getAll(),
		};

		try {
			await this.config.execute(context);
		} catch (error) {
			console.error(`Workflow "${this.config.name}" error:`, error);
			throw error;
		}

		return this.state;
	}

	/**
	 * Get current workflow state
	 */
	getState(): WorkflowState<TResult, TMeta> {
		return this.state;
	}

	/**
	 * Get workflow name
	 */
	getName(): string {
		return this.config.name;
	}

	/**
	 * Reset workflow to initial state
	 */
	reset(): void {
		for (const task of this.taskList.getAll()) {
			this.taskList.reset(task.id);
		}
		this.state.metadata = this.config.metadata || {};
	}
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a workflow
 */
export function createWorkflow<
	TAgents extends Record<string, BaseAnthropicAgent>,
	TResult = unknown,
	TMeta = Record<string, unknown>,
>(config: WorkflowConfig<TAgents, TResult, TMeta>): Workflow<TAgents, TResult, TMeta> {
	return new Workflow(config);
}
