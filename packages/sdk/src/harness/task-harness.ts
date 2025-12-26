/**
 * TaskHarness - Orchestrates task execution with Parser, Coding, and Review agents
 *
 * The harness:
 * 1. Parses tasks.md using ParserAgent
 * 2. Executes tasks in dependency order using CodingAgent
 * 3. Validates each task using ReviewAgent
 * 4. Tracks state and emits narratives
 *
 * @module harness/task-harness
 */

import * as fs from "node:fs/promises";
import { inject, injectable } from "@needle-di/core";
import type { IAgentCallbacks } from "../callbacks/types.js";
import { type IEventBus, IEventBusToken, type ITaskHarness, type ITaskHarnessCallbacks } from "../core/tokens.js";
import { ParserAgent } from "../providers/anthropic/agents/parser-agent.js";
import { ValidationReviewAgent } from "../providers/anthropic/agents/validation-review-agent.js";
import type { BackoffConfig } from "./backoff.js";
import { CompositeRenderer } from "./composite-renderer.js";
import { resolveDependencies } from "./dependency-resolver.js";
import type { HarnessEvent } from "./event-protocol.js";
import { HarnessRecorder, loadStateEvents, reconstructCheckpoint, type StateEventType } from "./harness-recorder.js";
import type { IHarnessRenderer, RendererConfig } from "./renderer-interface.js";
import type {
	CodingAgentOutput,
	FailureRecord,
	HarnessSummary,
	NarrativeEntry,
	ParsedTask,
	ParserAgentOutput,
	PhaseInfo,
	RetryRecord,
	ReviewAgentInput,
	ReviewAgentOutput,
	ReviewContext,
	TaskHarnessConfig,
	TaskHarnessState,
	TaskResult,
	ValidationResult,
} from "./task-harness-types.js";
import {
	completeTask,
	createInitialState,
	createNarrativeEntry,
	failTask,
	getNextTask,
	getTask,
	isComplete,
	recordRetry,
	setTasks,
	startTask,
	validateTask,
} from "./task-state.js";

/**
 * Default task timeout: 5 minutes.
 */
const DEFAULT_TASK_TIMEOUT_MS = 300000;

/**
 * Default backoff configuration for rate limits.
 * @todo Use for rate limit handling in executeWithRetry
 */
const _DEFAULT_BACKOFF: BackoffConfig = {
	baseDelayMs: 1000,
	maxDelayMs: 60000,
	maxJitterMs: 500,
	maxAttempts: 10,
};

/**
 * TaskHarness - Executes tasks.md files through SDK agents.
 *
 * Features:
 * - Parses tasks.md into structured tasks
 * - Executes tasks in dependency order
 * - Validates each task with ReviewAgent
 * - Supports resume from checkpoint
 * - Emits unified narrative stream
 *
 * @example
 * ```typescript
 * const harness = new TaskHarness(config);
 *
 * const summary = await harness.run({
 *   onNarrative: (entry) => console.log(`[${entry.agentName}] ${entry.text}`),
 *   onTaskComplete: (task, result) => console.log(`✓ ${task.id}`),
 * });
 *
 * console.log(`Validated ${summary.validatedTasks}/${summary.totalTasks} tasks`);
 * ```
 */
@injectable()
export class TaskHarness implements ITaskHarness {
	private state: TaskHarnessState;
	private config: TaskHarnessConfig;
	private aborted = false;
	private narratives: NarrativeEntry[] = [];
	private startTime = 0;
	private recorder: HarnessRecorder | null = null;
	private renderer: IHarnessRenderer | null = null;
	private currentPhase: { name: string; number: number } | null = null;

	/** Maximum retry attempts for validation failures */
	private static readonly MAX_VALIDATION_RETRIES = 2;

	/** Default recordings directory */
	private static readonly DEFAULT_RECORDINGS_DIR = "recordings/harness";

	constructor(
		config: TaskHarnessConfig,
		private parserAgent: ParserAgent = inject(ParserAgent),
		private reviewAgent: ValidationReviewAgent = inject(ValidationReviewAgent),
		_eventBus: IEventBus | null = inject(IEventBusToken, { optional: true }) ?? null,
	) {
		this.config = {
			...config,
			taskTimeoutMs: config.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS,
			continueOnFailure: config.continueOnFailure ?? false,
		};

		this.state = createInitialState(this.config);

		// Initialize recorder if recording is enabled
		if (this.config.recordingsDir || this.config.mode === "live") {
			this.recorder = new HarnessRecorder({
				recordingsDir: this.config.recordingsDir ?? TaskHarness.DEFAULT_RECORDINGS_DIR,
				sessionId: this.state.sessionId,
				includeSnapshots: this.config.includeStateSnapshots ?? false,
			});
		}
	}

	/**
	 * Set the renderer for this harness.
	 *
	 * The renderer receives events during execution for visual output.
	 * Must be called before run() to be effective.
	 *
	 * @param renderer - The renderer to use
	 */
	setRenderer(renderer: IHarnessRenderer): void {
		this.renderer = renderer;
	}

	/**
	 * Set multiple renderers for this harness.
	 *
	 * Creates a CompositeRenderer internally to fan out events to all renderers.
	 * Must be called before run() to be effective.
	 *
	 * @param renderers - The renderers to use
	 */
	setRenderers(renderers: IHarnessRenderer[]): void {
		if (renderers.length === 0) {
			this.renderer = null;
		} else if (renderers.length === 1) {
			this.renderer = renderers[0] ?? null;
		} else {
			const composite = new CompositeRenderer();
			for (const r of renderers) {
				composite.add(r);
			}
			this.renderer = composite;
		}
	}

	/**
	 * Run the harness to execute all tasks.
	 *
	 * @param callbacks - Optional callbacks for progress updates
	 * @returns Summary of execution
	 */
	async run(callbacks?: ITaskHarnessCallbacks): Promise<HarnessSummary> {
		this.startTime = Date.now();
		this.aborted = false;

		try {
			// Initialize recorder
			if (this.recorder) {
				await this.recorder.initialize();
				await this.logStateEvent("harness_started", null, {
					tasksFilePath: this.config.tasksFilePath,
					mode: this.config.mode,
				});
			}

			// Check for checkpoint resume
			if (this.config.resumeFromCheckpoint) {
				await this.resumeFromCheckpoint(callbacks);
			}

			// Emit start narrative
			this.emitNarrative("Harness", "Starting task execution harness...", null, callbacks);

			// Step 1: Parse tasks.md
			const parseResult = await this.parseTasks(callbacks);
			if (!parseResult || this.aborted) {
				const summary = this.buildSummary();
				await this.finalizeRecording(summary);
				await this.finalizeRenderer(summary);
				return summary;
			}

			// Log parsing complete
			await this.logStateEvent("tasks_parsed", null, {
				totalTasks: parseResult.metadata.totalTasks,
				pendingTasks: parseResult.metadata.pendingTasks,
			});

			// Step 2: Build execution queue
			const sortResult = resolveDependencies(parseResult.tasks);
			if (!sortResult.success) {
				this.emitNarrative(
					"Harness",
					`Dependency cycles detected: ${sortResult.cycles.map((c) => c.join(" → ")).join("; ")}`,
					null,
					callbacks,
				);
			}

			// Filter to pending tasks only
			const pendingIds = new Set(parseResult.tasks.filter((t) => t.status === "pending").map((t) => t.id));
			const pendingQueue = sortResult.sorted.filter((id) => pendingIds.has(id));

			this.state = setTasks(this.state, parseResult.tasks, pendingQueue);

			// Initialize renderer with parsed tasks
			await this.initializeRenderer(parseResult.tasks);

			// Emit harness:start event
			this.emitEvent({
				type: "harness:start",
				tasks: parseResult.tasks,
				sessionId: this.state.sessionId,
				mode: this.config.mode,
			});

			this.emitNarrative(
				"Harness",
				`Found ${parseResult.metadata.totalTasks} tasks (${parseResult.metadata.pendingTasks} pending, ${parseResult.metadata.completeTasks} complete)`,
				null,
				callbacks,
			);

			// Step 3: Execute tasks
			await this.executeTaskLoop(callbacks);

			// Step 4: Build and return summary
			const summary = this.buildSummary();

			// Finalize recording
			await this.logStateEvent("harness_completed", null, {
				validatedTasks: summary.validatedTasks,
				failedTasks: summary.failedTasks,
			});
			await this.finalizeRecording(summary);

			// Emit harness:complete event
			this.emitEvent({ type: "harness:complete", summary });

			this.emitNarrative(
				"Harness",
				`Execution complete: ${summary.validatedTasks} validated, ${summary.failedTasks} failed, ${summary.skippedTasks} skipped`,
				null,
				callbacks,
			);

			// Finalize renderer
			await this.finalizeRenderer(summary);

			callbacks?.onComplete?.(summary);
			return summary;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.emitNarrative("Harness", `Execution failed: ${errorMessage}`, null, callbacks);

			// Emit harness:error event
			this.emitEvent({
				type: "harness:error",
				error: error instanceof Error ? error : new Error(errorMessage),
			});

			// Log abort and finalize
			await this.logStateEvent("harness_aborted", null, { error: errorMessage });
			await this.finalizeRecording(null);
			await this.finalizeRenderer(null);

			throw error;
		}
	}

	/**
	 * Initialize the renderer if present.
	 */
	private async initializeRenderer(tasks: ParsedTask[]): Promise<void> {
		if (!this.renderer) return;

		const config: RendererConfig = {
			mode: this.config.mode,
			sessionId: this.state.sessionId,
			showTimestamps: false,
			collapseCompleted: false,
			showTokenUsage: true,
		};

		await this.renderer.initialize(tasks, config);
	}

	/**
	 * Finalize the renderer if present.
	 */
	private async finalizeRenderer(summary: HarnessSummary | null): Promise<void> {
		if (!this.renderer || !summary) return;
		await this.renderer.finalize(summary);
	}

	/**
	 * Resume execution from a checkpoint.
	 */
	private async resumeFromCheckpoint(callbacks?: ITaskHarnessCallbacks): Promise<void> {
		const checkpointPath = this.config.resumeFromCheckpoint;
		if (!checkpointPath) return;

		try {
			const statePath = `${checkpointPath}/state.jsonl`;
			const events = await loadStateEvents(statePath);
			const checkpoint = reconstructCheckpoint(events);

			// Apply checkpoint to state
			for (const taskId of checkpoint.validatedTaskIds) {
				const task = getTask(this.state, taskId);
				if (task) {
					this.state = validateTask(this.state, taskId, {
						taskId,
						passed: true,
						reasoning: "Restored from checkpoint",
						suggestedFixes: [],
						confidence: 1.0,
						uncertainties: [],
					});
				}
			}

			this.emitNarrative(
				"Harness",
				`Resumed from checkpoint: ${checkpoint.validatedTaskIds.size} validated, ${checkpoint.failedTaskIds.size} failed`,
				null,
				callbacks,
			);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.emitNarrative("Harness", `Failed to resume from checkpoint: ${msg}`, null, callbacks);
		}
	}

	/**
	 * Log a state event to the recorder.
	 */
	private async logStateEvent(
		event: StateEventType,
		taskId: string | null,
		data?: Record<string, unknown>,
	): Promise<void> {
		if (this.recorder) {
			await this.recorder.logEvent(event, taskId, data, this.state);
		}
	}

	/**
	 * Finalize the recording and save run data.
	 */
	private async finalizeRecording(summary: HarnessSummary | null): Promise<void> {
		if (this.recorder) {
			await this.recorder.saveRun(this.config.tasksFilePath, summary);
		}
	}

	/**
	 * Get current harness state.
	 */
	getState(): TaskHarnessState {
		return this.state;
	}

	/**
	 * Get session ID for this run.
	 */
	getSessionId(): string {
		return this.state.sessionId;
	}

	/**
	 * Abort execution.
	 */
	abort(): void {
		this.aborted = true;
	}

	/**
	 * Parse tasks.md file.
	 */
	private async parseTasks(callbacks?: ITaskHarnessCallbacks): Promise<ParserAgentOutput | null> {
		this.emitNarrative("Parser", "Reading tasks file...", null, callbacks);

		try {
			// Read file content
			const tasksContent = await fs.readFile(this.config.tasksFilePath, "utf-8");

			// Parse with ParserAgent
			const parserCallbacks: IAgentCallbacks<ParserAgentOutput> = {
				onStart: () => {
					this.emitNarrative("Parser", "Parsing task structure...", null, callbacks);
				},
				onComplete: (result) => {
					if (result.success && result.output) {
						this.emitNarrative(
							"Parser",
							`Parsed ${result.output.tasks.length} tasks across ${result.output.phases.length} phases`,
							null,
							callbacks,
						);
					}
				},
			};

			const result = await this.parserAgent.parse(
				{
					tasksFilePath: this.config.tasksFilePath,
					tasksContent,
				},
				parserCallbacks,
			);

			// Emit any warnings
			for (const warning of result.warnings) {
				this.emitNarrative("Parser", `Warning: ${warning}`, null, callbacks);
			}

			callbacks?.onTasksParsed?.(result);
			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.emitNarrative("Parser", `Failed to parse tasks: ${errorMessage}`, null, callbacks);
			return null;
		}
	}

	/**
	 * Execute the main task loop.
	 */
	private async executeTaskLoop(callbacks?: ITaskHarnessCallbacks): Promise<void> {
		while (!this.aborted && !isComplete(this.state)) {
			const taskId = getNextTask(this.state);
			if (!taskId) break;

			const task = getTask(this.state, taskId);
			if (!task) {
				this.emitNarrative("Harness", `Task ${taskId} not found in state`, null, callbacks);
				continue;
			}

			// Emit phase:start if entering a new phase
			this.emitPhaseStartIfNeeded(task);

			await this.executeTask(task, callbacks);

			// Emit phase:complete if this was the last task in the phase
			this.emitPhaseCompleteIfNeeded(task);

			// Check if we should stop (fail-fast mode and failure occurred)
			if (!this.state.continueOnFailure && Object.keys(this.state.failedTasks).length > 0) {
				this.emitNarrative("Harness", "Stopping due to task failure (fail-fast mode)", null, callbacks);
				break;
			}
		}
	}

	/**
	 * Emit phase:start event if entering a new phase.
	 */
	private emitPhaseStartIfNeeded(task: ParsedTask): void {
		if (!this.currentPhase || this.currentPhase.number !== task.phaseNumber) {
			// Count tasks in this phase
			const tasksInPhase = this.state.tasks.filter((t) => t.phaseNumber === task.phaseNumber);
			this.currentPhase = { name: task.phase, number: task.phaseNumber };

			this.emitEvent({
				type: "phase:start",
				phase: task.phase,
				phaseNumber: task.phaseNumber,
				taskCount: tasksInPhase.length,
			});
		}
	}

	/**
	 * Emit phase:complete event if this was the last task in the phase.
	 */
	private emitPhaseCompleteIfNeeded(task: ParsedTask): void {
		if (!this.currentPhase || this.currentPhase.number !== task.phaseNumber) return;

		// Check if all tasks in this phase are done
		const tasksInPhase = this.state.tasks.filter((t) => t.phaseNumber === task.phaseNumber);
		const allDone = tasksInPhase.every(
			(t) => this.state.validatedTasks[t.id] || this.state.failedTasks[t.id] || t.status === "complete",
		);

		if (allDone) {
			this.emitEvent({
				type: "phase:complete",
				phaseNumber: task.phaseNumber,
			});
		}
	}

	/**
	 * Execute a single task.
	 */
	private async executeTask(task: ParsedTask, callbacks?: ITaskHarnessCallbacks): Promise<void> {
		this.emitNarrative("Harness", `Starting task ${task.id}`, task.id, callbacks);
		this.state = startTask(this.state, task.id);
		callbacks?.onTaskStart?.(task);

		// Emit task:start event
		this.emitEvent({ type: "task:start", task });

		// Log task started
		await this.logStateEvent("task_started", task.id, {
			phase: task.phase,
			description: task.description.substring(0, 100),
		});

		try {
			// Execute with timeout and backoff
			const result = await this.executeWithTimeout(task, callbacks);

			if (result.success) {
				this.state = completeTask(this.state, task.id, result);
				callbacks?.onTaskComplete?.(task, result);

				// Emit task:complete event
				this.emitEvent({ type: "task:complete", taskId: task.id, result });

				// Log task completed
				await this.logStateEvent("task_completed", task.id, {
					success: true,
					filesModified: result.filesModified,
				});

				// Validate the task
				await this.validateTaskResult(task, result, callbacks);
			} else {
				await this.handleTaskFailure(task, "coding", result.summary, true, callbacks);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const isTimeout = errorMessage.includes("timed out");
			await this.handleTaskFailure(task, "coding", errorMessage, !isTimeout, callbacks);
		}
	}

	/**
	 * Execute task with timeout.
	 * @todo Implement actual timeout using _timeoutMs once CodingAgent is integrated
	 */
	private async executeWithTimeout(task: ParsedTask, callbacks?: ITaskHarnessCallbacks): Promise<TaskResult> {
		const _timeoutMs = this.config.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;

		// For now, return a mock result since we don't have CodingAgent integrated yet
		// This will be replaced with actual CodingAgent execution in a future task
		return this.mockExecuteTask(task, callbacks);
	}

	/**
	 * Mock task execution (placeholder until CodingAgent integration).
	 */
	private async mockExecuteTask(task: ParsedTask, callbacks?: ITaskHarnessCallbacks): Promise<TaskResult> {
		this.emitNarrative("Coder", `Working on ${task.id}: ${task.description.substring(0, 50)}...`, task.id, callbacks);

		// Simulate some work
		await new Promise((resolve) => setTimeout(resolve, 100));

		this.emitNarrative("Coder", `Completed ${task.id}`, task.id, callbacks);

		return {
			taskId: task.id,
			success: true,
			summary: `Task ${task.id} completed (mock)`,
			filesModified: task.filePaths,
			output: {},
			durationMs: 100,
			tokenUsage: {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadInputTokens: 0,
				cacheCreationInputTokens: 0,
			},
		};
	}

	/**
	 * Validate a completed task with retry support.
	 *
	 * The validation loop:
	 * 1. Call ReviewAgent to validate task
	 * 2. If passed → mark validated
	 * 3. If failed → record retry, optionally re-execute with feedback
	 * 4. After MAX_VALIDATION_RETRIES → mark as failed
	 */
	private async validateTaskResult(
		task: ParsedTask,
		codingResult: TaskResult,
		callbacks?: ITaskHarnessCallbacks,
	): Promise<void> {
		const previousAttempts: ValidationResult[] = [];
		let attempts = 0;

		// Emit validation:start event
		this.emitEvent({ type: "validation:start", taskId: task.id });

		while (attempts < TaskHarness.MAX_VALIDATION_RETRIES) {
			attempts++;
			this.emitNarrative(
				"Reviewer",
				attempts === 1 ? `Validating ${task.id}...` : `Re-validating ${task.id} (attempt ${attempts})...`,
				task.id,
				callbacks,
			);

			// Get phase info for context
			const phase = this.getPhaseForTask(task);

			// Build validation input
			const validationInput = this.buildValidationInput(task, codingResult, phase, previousAttempts);

			// Run validation (use mock in test mode, real agent in live mode)
			const reviewOutput = await this.runValidation(task, validationInput, callbacks);
			const validationResult = this.reviewAgent.toValidationResult(task.id, reviewOutput);

			if (validationResult.passed) {
				this.state = validateTask(this.state, task.id, validationResult);
				this.emitNarrative(
					"Reviewer",
					`✓ ${task.id} validated (confidence: ${(validationResult.confidence * 100).toFixed(0)}%)`,
					task.id,
					callbacks,
				);

				// Emit validation:complete event
				this.emitEvent({ type: "validation:complete", taskId: task.id, result: validationResult });

				// Log task validated
				await this.logStateEvent("task_validated", task.id, {
					confidence: validationResult.confidence,
					reasoning: validationResult.reasoning.substring(0, 200),
				});

				callbacks?.onTaskValidated?.(task, validationResult);
				return;
			}

			// Validation failed - record retry attempt
			previousAttempts.push(validationResult);

			const retryRecord: RetryRecord = {
				attempt: attempts,
				previousFailure: {
					taskId: task.id,
					stage: "validation",
					error: validationResult.reasoning,
					retryable: true,
					timestamp: Date.now(),
				},
				feedback: validationResult.suggestedFixes.join("; "),
				timestamp: Date.now(),
			};
			this.state = recordRetry(this.state, task.id, retryRecord);

			this.emitNarrative(
				"Reviewer",
				`✗ ${task.id} validation failed: ${validationResult.reasoning}`,
				task.id,
				callbacks,
			);

			// Emit task:retry event if we'll retry
			if (attempts < TaskHarness.MAX_VALIDATION_RETRIES && validationResult.confidence >= 0.3) {
				this.emitEvent({
					type: "task:retry",
					taskId: task.id,
					attempt: attempts,
					maxAttempts: TaskHarness.MAX_VALIDATION_RETRIES,
					reason: validationResult.reasoning,
				});
			}

			// Check for abort signal (validation is futile)
			if (validationResult.confidence < 0.3) {
				this.emitNarrative(
					"Reviewer",
					`Low confidence (${(validationResult.confidence * 100).toFixed(0)}%) - aborting retries`,
					task.id,
					callbacks,
				);
				break;
			}

			// In a full implementation, we would re-run CodingAgent with the feedback here
			// For now, we just retry validation to show the loop structure
		}

		// Emit validation:failed event
		const failure: FailureRecord = {
			taskId: task.id,
			stage: "validation",
			error:
				previousAttempts.length > 0
					? `Validation failed after ${attempts} attempts: ${previousAttempts[previousAttempts.length - 1]?.reasoning}`
					: "Validation failed",
			retryable: false,
			timestamp: Date.now(),
		};
		this.emitEvent({ type: "validation:failed", taskId: task.id, failure });

		// All retries exhausted - mark as failed
		await this.handleTaskFailure(task, "validation", failure.error, false, callbacks);
	}

	/**
	 * Build the input for the validation agent.
	 */
	private buildValidationInput(
		task: ParsedTask,
		codingResult: TaskResult,
		phase: PhaseInfo,
		previousAttempts: ValidationResult[],
	): ReviewAgentInput {
		// Convert TaskResult to CodingAgentOutput format
		const codingOutput: CodingAgentOutput = {
			success: codingResult.success,
			summary: codingResult.summary,
			filesModified: codingResult.filesModified ?? [],
			actions: [],
		};

		const context: ReviewContext = {
			phase,
			expectedFiles: task.filePaths,
			previousAttempts,
		};

		return {
			task,
			codingResult: codingOutput,
			validationCriteria: task.validationCriteria,
			context,
		};
	}

	/**
	 * Run validation - uses mock in replay mode, real agent in live mode.
	 */
	private async runValidation(
		task: ParsedTask,
		input: ReviewAgentInput,
		callbacks?: ITaskHarnessCallbacks,
	): Promise<ReviewAgentOutput> {
		if (this.config.mode === "replay") {
			// Mock validation for replay mode
			return this.mockValidation(task, input);
		}

		// Real validation via ReviewAgent
		try {
			return await this.reviewAgent.validate(input, this.state.sessionId, {
				timeoutMs: this.config.taskTimeoutMs,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.emitNarrative("Reviewer", `Validation error: ${errorMessage}`, task.id, callbacks);

			// Return a failure result on error
			return {
				passed: false,
				reasoning: `Validation agent error: ${errorMessage}`,
				suggestedFixes: [],
				confidence: 0.0,
				uncertainties: ["Agent execution failed"],
				checksPerformed: [],
			};
		}
	}

	/**
	 * Mock validation for replay mode.
	 */
	private mockValidation(task: ParsedTask, _input: ReviewAgentInput): ReviewAgentOutput {
		// In replay mode, auto-pass validation
		return {
			passed: true,
			reasoning: `Task ${task.id} validated (mock)`,
			suggestedFixes: [],
			confidence: 1.0,
			uncertainties: [],
			checksPerformed: [
				{
					check: "Mock validation",
					passed: true,
					details: "Auto-pass in replay mode",
				},
			],
		};
	}

	/**
	 * Get phase info for a task.
	 */
	private getPhaseForTask(task: ParsedTask): PhaseInfo {
		// Find the phase in parsed phases, or create a default
		const phases = this.state.tasks
			.filter((t) => t.phase === task.phase)
			.map((t) => ({
				number: t.phaseNumber,
				name: t.phase,
				purpose: "",
				goal: "",
				independentTest: null,
			}));

		return (
			phases[0] ?? {
				number: task.phaseNumber,
				name: task.phase,
				purpose: "",
				goal: task.validationCriteria,
				independentTest: null,
			}
		);
	}

	/**
	 * Handle a task failure.
	 */
	private async handleTaskFailure(
		task: ParsedTask,
		stage: "coding" | "validation",
		error: string,
		retryable: boolean,
		callbacks?: ITaskHarnessCallbacks,
	): Promise<void> {
		const failure: FailureRecord = {
			taskId: task.id,
			stage,
			error,
			retryable,
			timestamp: Date.now(),
		};

		this.state = failTask(this.state, task.id, failure);
		this.emitNarrative("Harness", `✗ ${task.id} failed at ${stage}: ${error}`, task.id, callbacks);

		// Emit task:failed event
		this.emitEvent({ type: "task:failed", taskId: task.id, failure });

		callbacks?.onTaskFailed?.(task, failure);

		// Log task_failed event for recording
		await this.logStateEvent("task_failed", task.id, { stage, error, retryable });
	}

	/**
	 * Emit a narrative entry.
	 */
	private emitNarrative(
		agentName: NarrativeEntry["agentName"],
		text: string,
		taskId: string | null,
		callbacks?: ITaskHarnessCallbacks,
	): void {
		const entry = createNarrativeEntry(agentName, text, taskId);
		this.narratives.push(entry);
		callbacks?.onNarrative?.(entry);
		// Record narrative for replay
		this.recorder?.recordNarrative(entry);

		// Emit to renderer if present
		if (this.renderer && taskId) {
			this.emitEvent({
				type: "task:narrative",
				taskId,
				entry: {
					timestamp: entry.timestamp,
					agentName: entry.agentName as "Parser" | "Coder" | "Reviewer" | "Validator" | "Harness",
					taskId: entry.taskId,
					text: entry.text,
				},
			});
		}
	}

	/**
	 * Emit an event to the renderer.
	 */
	private emitEvent(event: HarnessEvent): void {
		this.renderer?.handleEvent(event);
	}

	/**
	 * Build execution summary.
	 */
	private buildSummary(): HarnessSummary {
		const durationMs = Date.now() - this.startTime;

		// Calculate total retries across all tasks
		const totalRetries = Object.values(this.state.retryHistory).reduce((sum, retries) => sum + retries.length, 0);

		return {
			totalTasks: this.state.tasks.length,
			completedTasks: Object.keys(this.state.completedTasks).length,
			validatedTasks: Object.keys(this.state.validatedTasks).length,
			failedTasks: Object.keys(this.state.failedTasks).length,
			skippedTasks: this.state.tasks.filter((t) => t.status === "complete").length,
			totalRetries,
			durationMs,
			tokenUsage: {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadInputTokens: 0,
				cacheCreationInputTokens: 0,
			},
		};
	}
}
