/**
 * Task Harness Types - Zod Schemas for SDK Validation
 *
 * This file defines all Zod schemas for the task harness system.
 * All types are exported with proper TypeScript inference via z.infer<>.
 *
 * @module harness/task-harness-types
 * @see {@link ../specs/002-sdk-validation/data-model.md} for entity documentation
 */

import { z } from "zod";

// ============================================================================
// Task Flags & Phase Info (T008)
// ============================================================================

/**
 * Flags parsed from task line markers.
 *
 * @example
 * // From: "- [ ] T020 [P] [US1] Create parser agent..."
 * const flags: TaskFlags = { parallel: true, constitution: null };
 */
export const TaskFlagsSchema = z.object({
	/** True if [P] flag present (can run in parallel) */
	parallel: z.boolean().describe("Whether task can run in parallel with others"),
	/** Constitution principle reference if present (e.g., "CONSTITUTION-II") */
	constitution: z.string().nullable().describe("Constitution reference if applicable"),
});
export type TaskFlags = z.infer<typeof TaskFlagsSchema>;

/**
 * Phase information extracted from tasks.md.
 *
 * @example
 * const phase: PhaseInfo = {
 *   number: 1,
 *   name: "Phase 1: Setup",
 *   purpose: "Project initialization and structure validation",
 *   independentTest: null,
 *   goal: null,
 * };
 */
export const PhaseInfoSchema = z.object({
	/** Phase number (1, 2, 3...) */
	number: z.number().int().min(0).describe("Phase number for ordering"),
	/** Full phase name (e.g., "Phase 1: Setup") */
	name: z.string().min(1).describe("Full phase name"),
	/** Purpose text from phase header */
	purpose: z.string().describe("Phase purpose description"),
	/** Independent test from phase (becomes validation criteria for tasks) */
	independentTest: z.string().nullable().describe("Phase-level validation criteria"),
	/** Goal text if present */
	goal: z.string().nullable().describe("Phase goal if specified"),
});
export type PhaseInfo = z.infer<typeof PhaseInfoSchema>;

/**
 * Single parsed task from tasks.md.
 *
 * @example
 * const task: ParsedTask = {
 *   id: "T020",
 *   phase: "Phase 3: User Story 1 - Task Parser Agent",
 *   phaseNumber: 3,
 *   description: "Create parser agent prompt template...",
 *   filePaths: ["packages/sdk/prompts/parser.md"],
 *   userStory: "US1",
 *   dependencies: [],
 *   status: "pending",
 *   validationCriteria: "Parser prompt template exists with required sections",
 *   flags: { parallel: false, constitution: null },
 * };
 */
export const ParsedTaskSchema = z.object({
	/** Task ID (e.g., "T001", "T030a") */
	id: z
		.string()
		.regex(/^T\d{3}[a-z]?$/)
		.describe("Task ID like T001, T030a"),
	/** Phase name (e.g., "Phase 1: Setup") */
	phase: z.string().min(1).describe("Phase this task belongs to"),
	/** Phase number for ordering (1, 2, 3...) */
	phaseNumber: z.number().int().min(0).describe("Phase number for ordering"),
	/** Task description text */
	description: z.string().min(1).describe("Full task description"),
	/** File paths mentioned in task */
	filePaths: z.array(z.string()).describe("File paths referenced in task"),
	/** User story reference (e.g., "US1") or null */
	userStory: z.string().nullable().describe("User story reference if applicable"),
	/** Task IDs this task depends on (e.g., ["T006", "T007"]) */
	dependencies: z.array(z.string()).describe("Task IDs this depends on"),
	/** Status from markdown checkbox */
	status: z.enum(["complete", "pending"]).describe("Task completion status"),
	/** Inferred or explicit validation criteria */
	validationCriteria: z.string().min(1).describe("How to validate this task is done"),
	/** Flags parsed from task line */
	flags: TaskFlagsSchema.describe("Task flags like [P] for parallel"),
});
export type ParsedTask = z.infer<typeof ParsedTaskSchema>;

// ============================================================================
// Task Result & Validation (T009)
// ============================================================================

/**
 * Token usage statistics for an agent execution.
 */
export const TokenUsageSchema = z.object({
	inputTokens: z.number().int().min(0).describe("Input tokens consumed"),
	outputTokens: z.number().int().min(0).describe("Output tokens generated"),
	cacheReadInputTokens: z.number().int().min(0).describe("Tokens read from cache"),
	cacheCreationInputTokens: z.number().int().min(0).describe("Tokens cached for future use"),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/**
 * Result from Coding Agent executing a task.
 *
 * @example
 * const result: TaskResult = {
 *   taskId: "T020",
 *   success: true,
 *   summary: "Created parser.md prompt template with all required sections",
 *   filesModified: ["packages/sdk/prompts/parser.md"],
 *   output: { templateCreated: true },
 *   durationMs: 5200,
 *   tokenUsage: { inputTokens: 1500, outputTokens: 800, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
 * };
 */
export const TaskResultSchema = z.object({
	/** Task that was executed */
	taskId: z.string().describe("ID of the executed task"),
	/** Whether coding completed without error */
	success: z.boolean().describe("Whether execution succeeded"),
	/** Agent's summary of work done */
	summary: z.string().describe("Description of what was done"),
	/** Files that were modified */
	filesModified: z.array(z.string()).describe("Paths of modified files"),
	/** Structured output from agent */
	output: z.unknown().describe("Agent-specific structured output"),
	/** Execution time in milliseconds */
	durationMs: z.number().int().min(0).describe("Execution duration in ms"),
	/** Token usage stats */
	tokenUsage: TokenUsageSchema.describe("Token consumption stats"),
});
export type TaskResult = z.infer<typeof TaskResultSchema>;

/**
 * Single validation check performed by Review Agent.
 */
export const ValidationCheckSchema = z.object({
	/** What was checked */
	check: z.string().describe("Description of the check"),
	/** Whether it passed */
	passed: z.boolean().describe("Check result"),
	/** Details about the check */
	details: z.string().describe("Additional details"),
});
export type ValidationCheck = z.infer<typeof ValidationCheckSchema>;

/**
 * Result from Review Agent validating a completed task.
 *
 * @example
 * const validation: ValidationResult = {
 *   taskId: "T020",
 *   passed: true,
 *   reasoning: "File exists and contains all required sections",
 *   suggestedFixes: [],
 *   confidence: 0.95,
 *   uncertainties: [],
 *   checksPerformed: [{ check: "File exists", passed: true, details: "packages/sdk/prompts/parser.md found" }],
 * };
 */
export const ValidationResultSchema = z.object({
	/** Task that was validated */
	taskId: z.string().describe("ID of the validated task"),
	/** Whether validation passed */
	passed: z.boolean().describe("Overall validation result"),
	/** Explanation of pass/fail decision */
	reasoning: z.string().describe("Reasoning for the decision"),
	/** Suggested fixes if failed */
	suggestedFixes: z.array(z.string()).describe("Fix suggestions if failed"),
	/** Confidence score 0-1 */
	confidence: z.number().min(0).max(1).describe("Confidence in the result"),
	/** Areas of uncertainty */
	uncertainties: z.array(z.string()).describe("Uncertain aspects"),
	/** Individual checks performed */
	checksPerformed: z.array(ValidationCheckSchema).optional().describe("Detailed checks"),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/**
 * Record of a task failure.
 *
 * @example
 * const failure: FailureRecord = {
 *   taskId: "T021",
 *   stage: "coding",
 *   error: "File not found: packages/sdk/src/agents/parser-agent.ts",
 *   retryable: true,
 *   timestamp: 1703520000000,
 * };
 */
export const FailureRecordSchema = z.object({
	/** Failed task ID */
	taskId: z.string().describe("ID of the failed task"),
	/** Stage where failure occurred */
	stage: z.enum(["coding", "validation"]).describe("Failure stage"),
	/** Error message */
	error: z.string().describe("Error description"),
	/** Whether retry might help */
	retryable: z.boolean().describe("Whether retry could succeed"),
	/** Unix timestamp of failure */
	timestamp: z.number().int().min(0).describe("Failure timestamp"),
});
export type FailureRecord = z.infer<typeof FailureRecordSchema>;

// ============================================================================
// Parser Agent I/O (T010)
// ============================================================================

/**
 * Input to Parser Agent.
 */
export const ParserAgentInputSchema = z.object({
	/** Path to tasks.md file */
	tasksFilePath: z.string().describe("Path to the tasks.md file"),
	/** Raw markdown content of tasks.md */
	tasksContent: z.string().describe("Markdown content to parse"),
	/** Optional: spec.md path for additional context */
	specFilePath: z.string().optional().describe("Optional spec file path"),
});
export type ParserAgentInput = z.infer<typeof ParserAgentInputSchema>;

/**
 * Metadata about the parsing operation.
 */
export const ParserMetadataSchema = z.object({
	/** Total tasks found */
	totalTasks: z.number().int().min(0).describe("Total tasks parsed"),
	/** Tasks marked complete */
	completeTasks: z.number().int().min(0).describe("Completed task count"),
	/** Tasks marked pending */
	pendingTasks: z.number().int().min(0).describe("Pending task count"),
	/** Detected dependency cycles (if any) */
	cycles: z.array(z.array(z.string())).describe("Dependency cycles found"),
	/** File path that was parsed */
	sourcePath: z.string().describe("Source file path"),
});
export type ParserMetadata = z.infer<typeof ParserMetadataSchema>;

/**
 * Output from Parser Agent (structured output schema).
 */
export const ParserAgentOutputSchema = z.object({
	/** Parsed tasks in order */
	tasks: z.array(ParsedTaskSchema).describe("All parsed tasks"),
	/** Phases found in file */
	phases: z.array(PhaseInfoSchema).describe("Phase information"),
	/** Any warnings during parsing */
	warnings: z.array(z.string()).describe("Parsing warnings"),
	/** Metadata about the parsing */
	metadata: ParserMetadataSchema.describe("Parsing metadata"),
});
export type ParserAgentOutput = z.infer<typeof ParserAgentOutputSchema>;

// ============================================================================
// Coding Agent I/O (T011)
// ============================================================================

/**
 * Single action taken by Coding Agent.
 */
export const CodingActionSchema = z.object({
	/** Action type */
	type: z.enum(["create", "modify", "delete", "run_command", "other"]).describe("Type of action"),
	/** Description of action */
	description: z.string().describe("What was done"),
	/** File path if applicable */
	filePath: z.string().optional().describe("Affected file path"),
	/** Command if applicable */
	command: z.string().optional().describe("Command that was run"),
});
export type CodingAction = z.infer<typeof CodingActionSchema>;

/**
 * Context provided to Coding Agent.
 */
export const CodingContextSchema = z.object({
	/** Phase information for this task */
	phase: PhaseInfoSchema.describe("Current phase info"),
	/** Recently completed tasks for context */
	recentCompletedTasks: z.array(TaskResultSchema).describe("Recent task results"),
	/** Spec file content if available */
	specContent: z.string().nullable().describe("Spec content for context"),
	/** Plan file content if available */
	planContent: z.string().nullable().describe("Plan content for context"),
});
export type CodingContext = z.infer<typeof CodingContextSchema>;

/**
 * Input to Coding Agent for task execution.
 */
export const CodingAgentInputSchema = z.object({
	/** The task to execute */
	task: ParsedTaskSchema.describe("Task to execute"),
	/** Context from harness state */
	context: CodingContextSchema.describe("Execution context"),
	/** Feedback from previous failed attempt (null on first try) */
	retryFeedback: z.string().nullable().describe("Feedback from failed attempt"),
	/** Number of previous attempts */
	attemptNumber: z.number().int().min(1).describe("Current attempt number"),
});
export type CodingAgentInput = z.infer<typeof CodingAgentInputSchema>;

/**
 * Output from Coding Agent.
 */
export const CodingAgentOutputSchema = z.object({
	/** Whether task execution succeeded */
	success: z.boolean().describe("Execution success"),
	/** Summary of what was done */
	summary: z.string().describe("Work summary"),
	/** Files that were modified */
	filesModified: z.array(z.string()).describe("Modified files"),
	/** Actions taken during execution */
	actions: z.array(CodingActionSchema).describe("Actions performed"),
	/** Optional signal that retrying is futile */
	abortSignal: z
		.object({
			shouldAbort: z.boolean(),
			reason: z.string(),
		})
		.optional()
		.describe("Abort signal if retry is futile"),
});
export type CodingAgentOutput = z.infer<typeof CodingAgentOutputSchema>;

// ============================================================================
// Review Agent I/O (T012)
// ============================================================================

/**
 * Context provided to Review Agent.
 */
export const ReviewContextSchema = z.object({
	/** Phase information */
	phase: PhaseInfoSchema.describe("Current phase info"),
	/** Files that should exist after task */
	expectedFiles: z.array(z.string()).describe("Expected file paths"),
	/** Previous validation attempts for this task */
	previousAttempts: z.array(ValidationResultSchema).describe("Previous validation results"),
});
export type ReviewContext = z.infer<typeof ReviewContextSchema>;

/**
 * Input to Review Agent for task validation.
 */
export const ReviewAgentInputSchema = z.object({
	/** The task that was executed */
	task: ParsedTaskSchema.describe("Executed task"),
	/** Result from Coding Agent */
	codingResult: CodingAgentOutputSchema.describe("Coding result to validate"),
	/** Validation criteria to check against */
	validationCriteria: z.string().describe("Criteria to check"),
	/** Additional context */
	context: ReviewContextSchema.describe("Validation context"),
});
export type ReviewAgentInput = z.infer<typeof ReviewAgentInputSchema>;

/**
 * Output from Review Agent.
 */
export const ReviewAgentOutputSchema = z.object({
	/** Whether validation passed */
	passed: z.boolean().describe("Validation result"),
	/** Explanation of pass/fail decision */
	reasoning: z.string().describe("Decision reasoning"),
	/** Suggested fixes if failed */
	suggestedFixes: z.array(z.string()).describe("Fix suggestions"),
	/** Confidence score 0-1 */
	confidence: z.number().min(0).max(1).describe("Result confidence"),
	/** Areas of uncertainty */
	uncertainties: z.array(z.string()).describe("Uncertain areas"),
	/** Individual checks performed */
	checksPerformed: z.array(ValidationCheckSchema).describe("Detailed checks"),
});
export type ReviewAgentOutput = z.infer<typeof ReviewAgentOutputSchema>;

// ============================================================================
// Task Harness Config & State (T013)
// ============================================================================

/**
 * Configuration for TaskHarness.
 *
 * @example
 * const config: TaskHarnessConfig = {
 *   tasksFilePath: "specs/001-sdk-core/tasks.md",
 *   mode: "live",
 *   continueOnFailure: false,
 *   taskTimeoutMs: 300000,
 * };
 */
export const TaskHarnessConfigSchema = z.object({
	/** Path to tasks.md file */
	tasksFilePath: z.string().describe("Path to tasks file"),
	/** Execution mode */
	mode: z.enum(["live", "replay"]).describe("Execution mode"),
	/** Continue on failure (default: false = fail-fast) */
	continueOnFailure: z.boolean().optional().default(false).describe("Whether to continue after failure"),
	/** Per-task timeout in ms (default: 300000 = 5 min) */
	taskTimeoutMs: z.number().int().min(0).optional().default(300000).describe("Task timeout in ms"),
	/** Session ID for recording/resume (auto-generated if not provided) */
	sessionId: z.string().optional().describe("Session identifier"),
	/** Path to resume from (checkpoint) */
	resumeFromCheckpoint: z.string().optional().describe("Checkpoint to resume from"),
	/** Directory to save recordings (default: recordings/harness/) */
	recordingsDir: z.string().optional().describe("Recordings directory path"),
	/** Include full state snapshots in recordings (default: false) */
	includeStateSnapshots: z.boolean().optional().default(false).describe("Include state snapshots"),
});
export type TaskHarnessConfig = z.infer<typeof TaskHarnessConfigSchema>;

/**
 * Narrative entry for unified stream.
 *
 * @example
 * const entry: NarrativeEntry = {
 *   timestamp: 1703520000000,
 *   agentName: "Parser",
 *   taskId: null,
 *   text: "I'm reading through the tasks file...",
 * };
 */
export const NarrativeEntrySchema = z.object({
	/** Unix timestamp */
	timestamp: z.number().int().min(0).describe("Entry timestamp"),
	/** Which agent emitted this */
	agentName: z.enum(["Parser", "Coder", "Reviewer", "Harness"]).describe("Source agent"),
	/** Task context if applicable */
	taskId: z.string().nullable().describe("Related task ID"),
	/** Narrative text */
	text: z.string().describe("Narrative content"),
});
export type NarrativeEntry = z.infer<typeof NarrativeEntrySchema>;

/**
 * Task Harness internal state.
 *
 * @example
 * const state: TaskHarnessState = {
 *   tasks: [],
 *   taskQueue: ["T001", "T002"],
 *   currentTaskId: "T001",
 *   completedTasks: {},
 *   validatedTasks: {},
 *   failedTasks: {},
 *   retryHistory: {},
 *   mode: "live",
 *   continueOnFailure: false,
 *   sessionId: "session-123",
 * };
 */
export const TaskHarnessStateSchema = z.object({
	/** All parsed tasks */
	tasks: z.array(ParsedTaskSchema).describe("All tasks"),
	/** Task IDs in execution order (topologically sorted) */
	taskQueue: z.array(z.string()).describe("Execution queue"),
	/** Currently executing task ID */
	currentTaskId: z.string().nullable().describe("Current task"),
	/** Task ID → result for completed tasks */
	completedTasks: z.record(z.string(), TaskResultSchema).describe("Completed task results"),
	/** Task ID → validation for validated tasks */
	validatedTasks: z.record(z.string(), ValidationResultSchema).describe("Validation results"),
	/** Task ID → failure for failed tasks */
	failedTasks: z.record(z.string(), FailureRecordSchema).describe("Failure records"),
	/** Task ID → retry attempts */
	retryHistory: z.record(z.string(), z.array(z.lazy(() => RetryRecordSchema))).describe("Retry history"),
	/** Execution mode */
	mode: z.enum(["live", "replay"]).describe("Current mode"),
	/** Whether to continue after failure */
	continueOnFailure: z.boolean().describe("Failure handling mode"),
	/** Session identifier */
	sessionId: z.string().describe("Session ID"),
});
export type TaskHarnessState = z.infer<typeof TaskHarnessStateSchema>;

// ============================================================================
// Agent Abort Signal & Retry Record (T014)
// ============================================================================

/**
 * Signal from agent that retrying is futile.
 *
 * @example
 * const signal: AgentAbortSignal = {
 *   shouldAbort: true,
 *   reason: "Dependency not available - requires external API key",
 * };
 */
export const AgentAbortSignalSchema = z.object({
	/** Whether to abort retry attempts */
	shouldAbort: z.boolean().describe("Whether to stop retrying"),
	/** Reason for abort */
	reason: z.string().describe("Abort reason"),
});
export type AgentAbortSignal = z.infer<typeof AgentAbortSignalSchema>;

/**
 * Record of a retry attempt.
 *
 * @example
 * const retry: RetryRecord = {
 *   attempt: 2,
 *   previousFailure: { taskId: "T021", stage: "validation", error: "Missing file", retryable: true, timestamp: 1703520000000 },
 *   feedback: "The file was created but is missing the validation section",
 *   timestamp: 1703520005000,
 * };
 */
export const RetryRecordSchema = z.object({
	/** Retry attempt number (1, 2, 3...) */
	attempt: z.number().int().min(1).describe("Attempt number"),
	/** The failure that triggered retry */
	previousFailure: FailureRecordSchema.describe("Previous failure"),
	/** Feedback provided to agent */
	feedback: z.string().describe("Retry feedback"),
	/** Unix timestamp of retry */
	timestamp: z.number().int().min(0).describe("Retry timestamp"),
});
export type RetryRecord = z.infer<typeof RetryRecordSchema>;

// ============================================================================
// Harness Summary & Recording (Additional Types)
// ============================================================================

/**
 * Summary of harness execution.
 */
export const HarnessSummarySchema = z.object({
	/** Total tasks parsed */
	totalTasks: z.number().int().min(0).describe("Total task count"),
	/** Tasks that completed coding */
	completedTasks: z.number().int().min(0).describe("Completed count"),
	/** Tasks that passed validation */
	validatedTasks: z.number().int().min(0).describe("Validated count"),
	/** Tasks that failed */
	failedTasks: z.number().int().min(0).describe("Failed count"),
	/** Tasks that were skipped */
	skippedTasks: z.number().int().min(0).describe("Skipped count"),
	/** Total retry attempts across all tasks */
	totalRetries: z.number().int().min(0).describe("Total retry count"),
	/** Total execution duration in ms */
	durationMs: z.number().int().min(0).describe("Total duration"),
	/** Aggregate token usage */
	tokenUsage: TokenUsageSchema.describe("Total token usage"),
});
export type HarnessSummary = z.infer<typeof HarnessSummarySchema>;

/**
 * Recording of a single agent execution.
 */
export const AgentRecordingSchema = z.object({
	/** Agent name */
	agentName: z.enum(["Parser", "Coder", "Reviewer"]).describe("Agent type"),
	/** Agent session ID */
	sessionId: z.string().describe("Recording session ID"),
	/** Task being processed (null for parser) */
	taskId: z.string().nullable().describe("Related task"),
	/** Path to JSONL recording file */
	filePath: z.string().describe("Recording file path"),
	/** Start timestamp */
	startTime: z.number().int().min(0).describe("Start time"),
	/** End timestamp */
	endTime: z.number().int().min(0).describe("End time"),
});
export type AgentRecording = z.infer<typeof AgentRecordingSchema>;

/**
 * Complete execution session (for recording/replay).
 */
export const HarnessRunSchema = z.object({
	/** Unique session ID */
	sessionId: z.string().describe("Session identifier"),
	/** Unix timestamp of start */
	startTime: z.number().int().min(0).describe("Start time"),
	/** Unix timestamp of end (null if in progress) */
	endTime: z.number().int().min(0).nullable().describe("End time"),
	/** Path to tasks.md that was parsed */
	tasksFile: z.string().describe("Tasks file path"),
	/** Final state snapshot */
	state: TaskHarnessStateSchema.describe("Final state"),
	/** All agent session recordings */
	recordings: z.array(AgentRecordingSchema).describe("Agent recordings"),
	/** All narrative emissions */
	narratives: z.array(NarrativeEntrySchema).describe("Narrative stream"),
});
export type HarnessRun = z.infer<typeof HarnessRunSchema>;

// ============================================================================
// State Event Types - MOVED to harness-recorder.ts
// See harness-recorder.ts for StateEvent, StateEventType, and related schemas
// ============================================================================

// ============================================================================
// Task Harness Interfaces (for class implementation)
// ============================================================================

/**
 * Task Harness callbacks for progress updates
 */
export interface ITaskHarnessCallbacks {
	onTasksParsed?: (result: ParserAgentOutput) => void;
	onTaskStart?: (task: ParsedTask) => void;
	onTaskComplete?: (task: ParsedTask, result: TaskResult) => void;
	onTaskValidated?: (task: ParsedTask, result: ValidationResult) => void;
	onTaskFailed?: (task: ParsedTask, failure: FailureRecord) => void;
	onNarrative?: (entry: NarrativeEntry) => void;
	onComplete?: (summary: HarnessSummary) => void;
}

/**
 * Task Harness interface for orchestrating task execution
 */
export interface ITaskHarness {
	/**
	 * Run the harness to execute tasks
	 * @param callbacks Optional callbacks for progress updates
	 * @returns Summary of execution
	 */
	run(callbacks?: ITaskHarnessCallbacks): Promise<HarnessSummary>;

	/**
	 * Get current harness state
	 */
	getState(): TaskHarnessState;

	/**
	 * Get session ID for this run
	 */
	getSessionId(): string;

	/**
	 * Abort execution
	 */
	abort(): void;
}
