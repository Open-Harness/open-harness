/**
 * Contracts: SDK Validation via Speckit Dogfooding
 *
 * These interfaces define the contracts between components.
 * This file serves as a design document - actual implementation
 * will use these as the basis for concrete types.
 */

// Note: Zod schemas will be defined in implementation
// This file defines TypeScript interfaces for design documentation

// =============================================================================
// Parser Agent Contracts
// =============================================================================

/**
 * Parser Agent: Converts tasks.md to structured task list
 *
 * Zod Schema (implementation):
 * ```typescript
 * const ParserAgentInputSchema = z.object({
 *   tasksFilePath: z.string().describe("Path to tasks.md file"),
 *   specFilePath: z.string().optional().describe("Optional spec.md for context"),
 *   tasksContent: z.string().describe("Raw markdown content of tasks.md"),
 * });
 *
 * const ParserAgentOutputSchema = z.object({
 *   tasks: z.array(ParsedTaskSchema),
 *   phases: z.array(PhaseInfoSchema),
 *   warnings: z.array(z.string()),
 *   metadata: ParserMetadataSchema,
 * });
 * ```
 */

/**
 * Input to Parser Agent
 */
export interface ParserAgentInput {
	/** Path to tasks.md file */
	tasksFilePath: string;
	/** Optional: spec.md path for additional context */
	specFilePath?: string;
	/** Raw markdown content of tasks.md (agent receives file content) */
	tasksContent: string;
}

/**
 * Output from Parser Agent (structured output schema)
 *
 * This is the structured output returned by the LLM.
 */
export interface ParserAgentOutput {
	/** Parsed tasks in order */
	tasks: ParsedTask[];
	/** Phases found in file */
	phases: PhaseInfo[];
	/** Any warnings during parsing (e.g., "Task T045 references unknown dependency T999") */
	warnings: string[];
	/** Metadata about the parsing */
	metadata: ParserMetadata;
}

/**
 * Metadata from parsing
 */
export interface ParserMetadata {
	/** Total tasks found */
	totalTasks: number;
	/** Tasks marked complete */
	completeTasks: number;
	/** Tasks marked pending */
	pendingTasks: number;
	/** Detected dependency cycles (if any) */
	cycles: string[][];
	/** File path that was parsed */
	sourcePath: string;
}

/**
 * Single parsed task
 *
 * Zod Schema (implementation):
 * ```typescript
 * const ParsedTaskSchema = z.object({
 *   id: z.string().regex(/^T\d{3}[a-z]?$/).describe("Task ID like T001, T030a"),
 *   phase: z.string().describe("Phase name"),
 *   phaseNumber: z.number().int().min(0),
 *   description: z.string().min(1),
 *   filePaths: z.array(z.string()),
 *   userStory: z.string().nullable(),
 *   dependencies: z.array(z.string()),
 *   status: z.enum(["complete", "pending"]),
 *   validationCriteria: z.string().min(1),
 *   flags: TaskFlagsSchema,
 * });
 * ```
 */
export interface ParsedTask {
	/** Task ID (e.g., "T001", "T030a") */
	id: string;
	/** Phase name (e.g., "Phase 1: Setup") */
	phase: string;
	/** Phase number for ordering (1, 2, 3...) */
	phaseNumber: number;
	/** Task description text */
	description: string;
	/** File paths mentioned in task */
	filePaths: string[];
	/** User story reference (e.g., "US1") or null */
	userStory: string | null;
	/** Task IDs this task depends on (e.g., ["T006", "T007"]) */
	dependencies: string[];
	/** Status from markdown checkbox */
	status: "complete" | "pending";
	/** Inferred or explicit validation criteria */
	validationCriteria: string;
	/** Flags parsed from task line */
	flags: TaskFlags;
}

/**
 * Flags parsed from task line markers
 */
export interface TaskFlags {
	/** True if [P] flag present (can run in parallel) */
	parallel: boolean;
	/** Constitution principle reference if present (e.g., "CONSTITUTION-II") */
	constitution: string | null;
}

/**
 * Phase information extracted from tasks.md
 */
export interface PhaseInfo {
	/** Phase number */
	number: number;
	/** Full phase name (e.g., "Phase 1: Setup") */
	name: string;
	/** Purpose text from phase header */
	purpose: string;
	/** Independent test from phase (becomes validation criteria for tasks) */
	independentTest: string | null;
	/** Goal text if present */
	goal: string | null;
}

// =============================================================================
// Coding Agent Contracts
// =============================================================================

/**
 * Coding Agent: Executes a single task
 *
 * The harness wraps the existing CodingAgent with task-specific context.
 *
 * Zod Schema (implementation):
 * ```typescript
 * const CodingAgentInputSchema = z.object({
 *   task: ParsedTaskSchema,
 *   context: CodingContextSchema,
 *   retryFeedback: z.string().nullable(),
 * });
 *
 * const CodingAgentOutputSchema = z.object({
 *   success: z.boolean(),
 *   summary: z.string(),
 *   filesModified: z.array(z.string()),
 *   actions: z.array(CodingActionSchema),
 *   abortSignal: AgentAbortSignalSchema.optional(),
 * });
 * ```
 */

/**
 * Input to Coding Agent for task execution
 */
export interface CodingAgentInput {
	/** The task to execute */
	task: ParsedTask;
	/** Context from harness state */
	context: CodingContext;
	/** Feedback from previous failed attempt (null on first try) */
	retryFeedback: string | null;
	/** Number of previous attempts */
	attemptNumber: number;
}

/**
 * Context provided to Coding Agent
 */
export interface CodingContext {
	/** Phase information for this task */
	phase: PhaseInfo;
	/** Recently completed tasks for context */
	recentCompletedTasks: TaskResult[];
	/** Spec file content if available */
	specContent: string | null;
	/** Plan file content if available */
	planContent: string | null;
}

/**
 * Output from Coding Agent
 */
export interface CodingAgentOutput {
	/** Whether task execution succeeded */
	success: boolean;
	/** Summary of what was done */
	summary: string;
	/** Files that were modified */
	filesModified: string[];
	/** Actions taken during execution */
	actions: CodingAction[];
	/** Optional signal that retrying is futile */
	abortSignal?: AgentAbortSignal;
}

/**
 * Single action taken by Coding Agent
 */
export interface CodingAction {
	/** Action type */
	type: "create" | "modify" | "delete" | "run_command" | "other";
	/** Description of action */
	description: string;
	/** File path if applicable */
	filePath?: string;
	/** Command if applicable */
	command?: string;
}

// =============================================================================
// Review Agent Contracts
// =============================================================================

/**
 * Review Agent: Validates a completed task
 *
 * Zod Schema (implementation):
 * ```typescript
 * const ReviewAgentInputSchema = z.object({
 *   task: ParsedTaskSchema,
 *   codingResult: CodingAgentOutputSchema,
 *   validationCriteria: z.string(),
 *   context: ReviewContextSchema,
 * });
 *
 * const ReviewAgentOutputSchema = z.object({
 *   passed: z.boolean(),
 *   reasoning: z.string(),
 *   suggestedFixes: z.array(z.string()),
 *   confidence: z.number().min(0).max(1),
 *   uncertainties: z.array(z.string()),
 *   checksPerformed: z.array(ValidationCheckSchema),
 * });
 * ```
 */

/**
 * Input to Review Agent for task validation
 */
export interface ReviewAgentInput {
	/** The task that was executed */
	task: ParsedTask;
	/** Result from Coding Agent */
	codingResult: CodingAgentOutput;
	/** Validation criteria to check against */
	validationCriteria: string;
	/** Additional context */
	context: ReviewContext;
}

/**
 * Context provided to Review Agent
 */
export interface ReviewContext {
	/** Phase information */
	phase: PhaseInfo;
	/** Files that should exist after task */
	expectedFiles: string[];
	/** Previous validation attempts for this task */
	previousAttempts: ValidationResult[];
}

/**
 * Output from Review Agent
 */
export interface ReviewAgentOutput {
	/** Whether validation passed */
	passed: boolean;
	/** Explanation of pass/fail decision */
	reasoning: string;
	/** Suggested fixes if failed */
	suggestedFixes: string[];
	/** Confidence score 0-1 */
	confidence: number;
	/** Areas of uncertainty */
	uncertainties: string[];
	/** Individual checks performed */
	checksPerformed: ValidationCheck[];
}

/**
 * Single validation check performed
 */
export interface ValidationCheck {
	/** What was checked */
	check: string;
	/** Whether it passed */
	passed: boolean;
	/** Details */
	details: string;
}

// =============================================================================
// Task Harness Contracts
// =============================================================================

/**
 * Configuration for TaskHarness
 */
export interface TaskHarnessConfig {
	/** Path to tasks.md file */
	tasksFilePath: string;
	/** Execution mode */
	mode: "live" | "replay";
	/** Continue on failure (default: false = fail-fast) */
	continueOnFailure?: boolean;
	/** Per-task timeout in ms (default: 300000 = 5 min) */
	taskTimeoutMs?: number;
	/** Session ID for recording/resume (auto-generated if not provided) */
	sessionId?: string;
	/** Path to resume from (checkpoint) */
	resumeFromCheckpoint?: string;
}

/**
 * Callbacks for harness execution
 */
export interface TaskHarnessCallbacks {
	/** Called when Parser Agent completes and tasks are available */
	onTasksParsed?: (result: ParserAgentOutput) => void;
	/** Called when a task starts */
	onTaskStart?: (task: ParsedTask) => void;
	/** Called when a task completes (before validation) */
	onTaskComplete?: (task: ParsedTask, result: TaskResult) => void;
	/** Called when a task is validated */
	onTaskValidated?: (task: ParsedTask, result: ValidationResult) => void;
	/** Called when a task fails */
	onTaskFailed?: (task: ParsedTask, failure: FailureRecord) => void;
	/** Called for all narrative output (aggregated from all agents) */
	onNarrative?: (entry: NarrativeEntry) => void;
	/** Called on harness completion */
	onComplete?: (summary: HarnessSummary) => void;
}

/**
 * Result of running a task through Coding Agent
 */
export interface TaskResult {
	taskId: string;
	success: boolean;
	summary: string;
	filesModified: string[];
	output: unknown;
	durationMs: number;
	tokenUsage: TokenUsage;
}

/**
 * Result of validating a task via Review Agent
 */
export interface ValidationResult {
	taskId: string;
	passed: boolean;
	reasoning: string;
	suggestedFixes: string[];
	confidence: number;
	uncertainties: string[];
}

/**
 * Record of a task failure
 */
export interface FailureRecord {
	taskId: string;
	stage: "coding" | "validation";
	error: string;
	retryable: boolean;
	timestamp: number;
}

/**
 * Narrative entry for unified stream
 */
export interface NarrativeEntry {
	timestamp: number;
	agentName: "Parser" | "Coder" | "Reviewer" | "Harness";
	taskId: string | null;
	text: string;
}

/**
 * Summary of harness execution
 */
export interface HarnessSummary {
	totalTasks: number;
	completedTasks: number;
	validatedTasks: number;
	failedTasks: number;
	skippedTasks: number;
	durationMs: number;
	tokenUsage: TokenUsage;
}

/**
 * Token usage stats
 */
export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	cacheReadInputTokens: number;
	cacheCreationInputTokens: number;
}

// =============================================================================
// Factory Contracts
// =============================================================================

/**
 * Factory function signature for creating task harness
 */
export type CreateTaskHarness = (config: TaskHarnessConfig) => TaskHarness;

/**
 * TaskHarness public interface
 */
export interface TaskHarness {
	/** Run the harness */
	run(callbacks?: TaskHarnessCallbacks): Promise<HarnessSummary>;
	/** Get current state */
	getState(): TaskHarnessState;
	/** Get session ID */
	getSessionId(): string;
	/** Abort execution */
	abort(): void;
}

/**
 * TaskHarness internal state (for serialization)
 */
export interface TaskHarnessState {
	tasks: ParsedTask[];
	taskQueue: string[];
	currentTaskId: string | null;
	completedTasks: Record<string, TaskResult>;
	validatedTasks: Record<string, ValidationResult>;
	failedTasks: Record<string, FailureRecord>;
	retryHistory: Record<string, RetryRecord[]>;
	mode: "live" | "replay";
	continueOnFailure: boolean;
	sessionId: string;
}

/**
 * Retry record
 */
export interface RetryRecord {
	attempt: number;
	previousFailure: FailureRecord;
	feedback: string;
	timestamp: number;
}

// =============================================================================
// Agent Abort Signal
// =============================================================================

/**
 * Signal from agent that retrying is futile
 */
export interface AgentAbortSignal {
	shouldAbort: boolean;
	reason: string;
}
