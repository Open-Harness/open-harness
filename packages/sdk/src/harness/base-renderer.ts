/**
 * BaseHarnessRenderer - Foundation for all harness renderers
 *
 * Provides state management and event routing so concrete renderers
 * only need to implement rendering logic, not state tracking.
 *
 * @module harness/base-renderer
 */

import type { HarnessEvent, NarrativeImportance, VerbosityLevel } from "./event-protocol.js";
import type {
	IHarnessRenderer,
	PhaseRenderState,
	RendererConfig,
	RenderState,
	TaskDisplayStatus,
	TaskRenderState,
} from "./renderer-interface.js";
import type { HarnessSummary, ParsedTask } from "./task-harness-types.js";

/**
 * BaseHarnessRenderer - Abstract base class for renderers.
 *
 * Handles all state management and event routing. Subclasses implement
 * the abstract `render*` methods to produce visual output.
 *
 * ## State Flow
 *
 * ```
 * HarnessEvent ──► handleEvent() ──► updateState() ──► render*()
 * ```
 *
 * @example
 * ```typescript
 * class MyRenderer extends BaseHarnessRenderer {
 *   protected renderTaskStart(task: ParsedTask, state: TaskRenderState): void {
 *     console.log(`▶ Starting ${task.id}...`);
 *   }
 *
 *   protected renderNarrative(entry: NarrativeEntry, state: TaskRenderState): void {
 *     console.log(`  ${entry.text}`);
 *   }
 *
 *   // ... implement other render methods
 * }
 * ```
 */
export abstract class BaseHarnessRenderer implements IHarnessRenderer {
	protected state: RenderState;
	protected config: RendererConfig;

	constructor() {
		// Initialize with empty state; properly initialized in initialize()
		this.state = this.createInitialState("", "live");
		this.config = { mode: "live", sessionId: "" };
	}

	// =========================================================================
	// IHarnessRenderer Implementation
	// =========================================================================

	initialize(tasks: ParsedTask[], config: RendererConfig): void | Promise<void> {
		this.config = config;
		this.state = this.createInitialState(config.sessionId, config.mode);

		// Build task states
		for (const task of tasks) {
			this.state.tasks.set(task.id, this.createTaskState(task));
		}

		// Build phase states
		this.buildPhaseStates(tasks);

		// Call concrete initialization
		return this.onInitialize(tasks, config);
	}

	handleEvent(event: HarnessEvent): void {
		// Update state based on event
		this.updateState(event);

		// Route to appropriate render method
		this.routeEvent(event);
	}

	finalize(summary: HarnessSummary): void | Promise<void> {
		this.state.isComplete = true;
		this.state.summary = summary;
		return this.onFinalize(summary);
	}

	// =========================================================================
	// Abstract Methods - Must be implemented by subclasses
	// =========================================================================

	/** Called after state is initialized */
	protected abstract onInitialize(tasks: ParsedTask[], config: RendererConfig): void | Promise<void>;

	/** Called after all events processed */
	protected abstract onFinalize(summary: HarnessSummary): void | Promise<void>;

	/** Render harness start */
	protected abstract renderHarnessStart(tasks: ParsedTask[]): void;

	/** Render harness error */
	protected abstract renderHarnessError(error: Error): void;

	/** Render phase start */
	protected abstract renderPhaseStart(phase: PhaseRenderState): void;

	/** Render phase complete */
	protected abstract renderPhaseComplete(phase: PhaseRenderState): void;

	/** Render task start */
	protected abstract renderTaskStart(task: ParsedTask, state: TaskRenderState): void;

	/** Render narrative entry */
	protected abstract renderNarrative(taskState: TaskRenderState): void;

	/** Render task complete */
	protected abstract renderTaskComplete(state: TaskRenderState): void;

	/** Render task failed */
	protected abstract renderTaskFailed(state: TaskRenderState): void;

	/** Render task skipped */
	protected abstract renderTaskSkipped(state: TaskRenderState, reason: string): void;

	/** Render task retry */
	protected abstract renderTaskRetry(state: TaskRenderState, attempt: number, maxAttempts: number): void;

	/** Render validation start */
	protected abstract renderValidationStart(taskState: TaskRenderState): void;

	/** Render validation complete */
	protected abstract renderValidationComplete(taskState: TaskRenderState): void;

	/** Render validation failed */
	protected abstract renderValidationFailed(taskState: TaskRenderState): void;

	// =========================================================================
	// State Management (Private)
	// =========================================================================

	private createInitialState(sessionId: string, mode: "live" | "replay"): RenderState {
		return {
			sessionId,
			mode,
			tasks: new Map(),
			phases: [],
			currentPhase: null,
			currentTaskId: null,
			narrativeHistory: [],
			isComplete: false,
			summary: null,
		};
	}

	private createTaskState(task: ParsedTask): TaskRenderState {
		return {
			task,
			displayStatus: "pending",
			narrative: "",
			narrativeHistory: [],
			validationStatus: "pending",
			retryCount: 0,
		};
	}

	private buildPhaseStates(tasks: ParsedTask[]): void {
		const phaseMap = new Map<number, { name: string; taskIds: string[] }>();

		for (const task of tasks) {
			const existing = phaseMap.get(task.phaseNumber);
			if (existing) {
				existing.taskIds.push(task.id);
			} else {
				phaseMap.set(task.phaseNumber, {
					name: task.phase,
					taskIds: [task.id],
				});
			}
		}

		// Convert to sorted array
		this.state.phases = Array.from(phaseMap.entries())
			.sort(([a], [b]) => a - b)
			.map(([phaseNumber, { name, taskIds }]) => ({
				name,
				phaseNumber,
				taskIds,
				isComplete: false,
				isCollapsed: false,
			}));
	}

	private updateState(event: HarnessEvent): void {
		switch (event.type) {
			case "harness:start":
				// State already set in initialize
				break;

			case "harness:complete":
				this.state.isComplete = true;
				this.state.summary = event.summary;
				break;

			case "phase:start":
				this.state.currentPhase = event.phaseNumber;
				break;

			case "phase:complete": {
				const phase = this.state.phases.find((p) => p.phaseNumber === event.phaseNumber);
				if (phase) {
					phase.isComplete = true;
				}
				break;
			}

			case "task:start": {
				const taskState = this.state.tasks.get(event.task.id);
				if (taskState) {
					taskState.displayStatus = "running";
					taskState.startTime = Date.now();
					this.state.currentTaskId = event.task.id;
				}
				break;
			}

			case "task:narrative": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					taskState.narrative = event.entry.text;
					taskState.narrativeHistory.push(event.entry.text);
					this.state.narrativeHistory.push(event.entry.text);
				}
				break;
			}

			case "task:complete": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					taskState.displayStatus = "complete";
					taskState.endTime = Date.now();
				}
				break;
			}

			case "task:failed": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					taskState.displayStatus = "failed";
					taskState.endTime = Date.now();
				}
				break;
			}

			case "task:skipped": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					taskState.displayStatus = "skipped";
				}
				break;
			}

			case "task:retry": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					taskState.displayStatus = "retrying";
					taskState.retryCount = event.attempt;
				}
				break;
			}

			case "validation:start": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					taskState.validationStatus = "running";
				}
				break;
			}

			case "validation:complete": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					taskState.validationStatus = event.result.passed ? "passed" : "failed";
				}
				break;
			}

			case "validation:failed": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					taskState.validationStatus = "failed";
				}
				break;
			}
		}
	}

	private routeEvent(event: HarnessEvent): void {
		switch (event.type) {
			case "harness:start":
				this.renderHarnessStart(event.tasks);
				break;

			case "harness:error":
				this.renderHarnessError(event.error);
				break;

			case "phase:start": {
				const phase = this.state.phases.find((p) => p.phaseNumber === event.phaseNumber);
				if (phase) {
					this.renderPhaseStart(phase);
				}
				break;
			}

			case "phase:complete": {
				const phase = this.state.phases.find((p) => p.phaseNumber === event.phaseNumber);
				if (phase) {
					this.renderPhaseComplete(phase);
				}
				break;
			}

			case "task:start": {
				const taskState = this.state.tasks.get(event.task.id);
				if (taskState) {
					this.renderTaskStart(event.task, taskState);
				}
				break;
			}

			case "task:narrative": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					// Apply verbosity filtering
					const importance = this.inferNarrativeImportance(event.entry.text, event.entry.importance);
					if (this.shouldShowNarrative(importance)) {
						this.renderNarrative(taskState);
					}
				}
				break;
			}

			case "task:complete": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					this.renderTaskComplete(taskState);
				}
				break;
			}

			case "task:failed": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					this.renderTaskFailed(taskState);
				}
				break;
			}

			case "task:skipped": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					this.renderTaskSkipped(taskState, event.reason);
				}
				break;
			}

			case "task:retry": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					this.renderTaskRetry(taskState, event.attempt, event.maxAttempts);
				}
				break;
			}

			case "validation:start": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					this.renderValidationStart(taskState);
				}
				break;
			}

			case "validation:complete": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					this.renderValidationComplete(taskState);
				}
				break;
			}

			case "validation:failed": {
				const taskState = this.state.tasks.get(event.taskId);
				if (taskState) {
					this.renderValidationFailed(taskState);
				}
				break;
			}
		}
	}

	// =========================================================================
	// Utility Methods for Subclasses
	// =========================================================================

	/** Get current task state */
	protected getCurrentTaskState(): TaskRenderState | null {
		if (!this.state.currentTaskId) return null;
		return this.state.tasks.get(this.state.currentTaskId) ?? null;
	}

	/** Get current phase state */
	protected getCurrentPhaseState(): PhaseRenderState | null {
		if (this.state.currentPhase === null) return null;
		return this.state.phases.find((p) => p.phaseNumber === this.state.currentPhase) ?? null;
	}

	/** Get task state by ID */
	protected getTaskState(taskId: string): TaskRenderState | null {
		return this.state.tasks.get(taskId) ?? null;
	}

	/** Get all tasks in a phase */
	protected getTasksInPhase(phaseNumber: number): TaskRenderState[] {
		const phase = this.state.phases.find((p) => p.phaseNumber === phaseNumber);
		if (!phase) return [];
		return phase.taskIds.map((id) => this.state.tasks.get(id)).filter((t): t is TaskRenderState => t !== undefined);
	}

	/** Calculate progress percentage */
	protected getProgressPercentage(): number {
		const total = this.state.tasks.size;
		if (total === 0) return 0;

		const completed = Array.from(this.state.tasks.values()).filter(
			(t) => t.displayStatus === "complete" || t.displayStatus === "skipped",
		).length;

		return Math.round((completed / total) * 100);
	}

	/** Get task counts by status */
	protected getTaskCounts(): Record<TaskDisplayStatus, number> {
		const counts: Record<TaskDisplayStatus, number> = {
			pending: 0,
			running: 0,
			complete: 0,
			failed: 0,
			skipped: 0,
			retrying: 0,
		};

		for (const task of this.state.tasks.values()) {
			counts[task.displayStatus]++;
		}

		return counts;
	}

	// =========================================================================
	// Narrative History Accessors
	// =========================================================================

	/**
	 * Get the full narrative history for a specific task.
	 *
	 * @param taskId - The task ID
	 * @returns Array of narrative strings (oldest first)
	 */
	protected getTaskNarrativeHistory(taskId: string): string[] {
		const taskState = this.state.tasks.get(taskId);
		return taskState?.narrativeHistory ?? [];
	}

	/**
	 * Get the full narrative history for a phase.
	 *
	 * @param phaseNumber - The phase number
	 * @returns Array of narrative strings from all tasks in the phase (in task order)
	 */
	protected getPhaseNarrativeHistory(phaseNumber: number): string[] {
		const tasksInPhase = this.getTasksInPhase(phaseNumber);
		return tasksInPhase.flatMap((t) => t.narrativeHistory);
	}

	/**
	 * Get the global narrative history across all tasks.
	 *
	 * @returns Array of all narrative strings (in chronological order)
	 */
	protected getGlobalNarrativeHistory(): string[] {
		return [...this.state.narrativeHistory];
	}

	/**
	 * Get narrative count for a task.
	 *
	 * @param taskId - The task ID
	 * @returns Number of narratives for the task
	 */
	protected getTaskNarrativeCount(taskId: string): number {
		const taskState = this.state.tasks.get(taskId);
		return taskState?.narrativeHistory.length ?? 0;
	}

	/**
	 * Get the most recent N narratives globally.
	 *
	 * @param count - Number of narratives to return
	 * @returns Most recent narratives (newest first)
	 */
	protected getRecentNarratives(count: number): string[] {
		return this.state.narrativeHistory.slice(-count).reverse();
	}

	// =========================================================================
	// Verbosity Filtering
	// =========================================================================

	/**
	 * Get the configured verbosity level.
	 *
	 * @returns The verbosity level (defaults to 'normal')
	 */
	protected getVerbosity(): VerbosityLevel {
		return this.config.verbosity ?? "normal";
	}

	/**
	 * Check if a narrative should be shown based on its importance and the configured verbosity.
	 *
	 * Filtering rules:
	 * - `minimal` verbosity: Only show `critical` narratives
	 * - `normal` verbosity: Show `critical` and `important` narratives
	 * - `verbose` verbosity: Show all narratives
	 *
	 * @param importance - The narrative's importance level (defaults to 'important')
	 * @returns True if the narrative should be displayed
	 */
	protected shouldShowNarrative(importance: NarrativeImportance = "important"): boolean {
		const verbosity = this.getVerbosity();

		switch (verbosity) {
			case "minimal":
				return importance === "critical";
			case "normal":
				return importance === "critical" || importance === "important";
			case "verbose":
				return true;
			default:
				return true;
		}
	}

	/**
	 * Get the importance level from a narrative entry's importance field.
	 * Provides default importance based on text content heuristics.
	 *
	 * @param text - The narrative text
	 * @param explicitImportance - Explicitly set importance level
	 * @returns The effective importance level
	 */
	protected inferNarrativeImportance(text: string, explicitImportance?: NarrativeImportance): NarrativeImportance {
		// Use explicit importance if provided
		if (explicitImportance) return explicitImportance;

		// Heuristic-based importance inference
		const lowerText = text.toLowerCase();

		// Critical: failures, errors, completion
		if (
			lowerText.includes("failed") ||
			lowerText.includes("error") ||
			lowerText.includes("abort") ||
			lowerText.includes("✗")
		) {
			return "critical";
		}

		// Important: validation results, key milestones
		if (
			lowerText.includes("validated") ||
			lowerText.includes("complete") ||
			lowerText.includes("starting") ||
			lowerText.includes("✓")
		) {
			return "important";
		}

		// Detailed: everything else (working on, processing, etc.)
		return "detailed";
	}
}
