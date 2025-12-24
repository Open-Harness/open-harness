/**
 * Harness Index Exports
 *
 * Central export point for all harness primitives and types.
 * Provides a clean API surface for SDK users.
 */

export { Agent } from "./agent.js";
// Backoff Utilities
export {
	type BackoffConfig,
	type BackoffContext,
	calculateDelay,
	createBackoffContext,
	DEFAULT_BACKOFF_CONFIG,
	isRateLimitError,
	shouldRetry,
	sleep,
	updateBackoffContext,
	withBackoff,
} from "./backoff.js";
// Classes
export { BaseHarness } from "./base-harness.js";
// Dependency Resolver
export {
	detectCycles,
	getReadyTasks,
	resolveDependencies,
	type TopologicalSortResult,
	validateDependencies,
} from "./dependency-resolver.js";
// Harness Recorder (Recording & Replay)
export {
	canResume,
	HarnessRecorder,
	type HarnessRecorderConfig,
	loadHarnessRun,
	loadStateEvents,
	reconstructCheckpoint,
	type StateEvent,
	StateEventSchema,
	type StateEventType,
	StateEventTypeSchema,
} from "./harness-recorder.js";
export { PersistentState } from "./state.js";
// Task Harness
export { TaskHarness } from "./task-harness.js";
// Task State Management
export {
	completeTask,
	createInitialState,
	createNarrativeEntry,
	failTask,
	getNextTask,
	getRetryCount,
	getTask,
	isComplete,
	recordRetry,
	setTasks,
	startTask,
	validateTask,
} from "./task-state.js";

// Types
export type {
	AgentConfig,
	AgentRunParams,
	Constraints,
	HarnessConfig,
	LoadedContext,
	PersistentStateConfig,
	StateDelta,
	Step,
	StepYield,
} from "./types.js";

// ============================================================================
// Task Harness Types (002-sdk-validation)
// ============================================================================

// Inferred Types
export type {
	// Retry & abort
	AgentAbortSignal,
	AgentRecording,
	// Coding Agent
	CodingAction,
	CodingAgentInput,
	CodingAgentOutput,
	CodingContext,
	FailureRecord,
	HarnessRun,
	// Summary & recording
	HarnessSummary,
	NarrativeEntry,
	ParsedTask,
	// Parser Agent
	ParserAgentInput,
	ParserAgentOutput,
	ParserMetadata,
	PhaseInfo,
	RetryRecord,
	ReviewAgentInput,
	ReviewAgentOutput,
	// Review Agent
	ReviewContext,
	// Core task types
	TaskFlags,
	// Harness config & state
	TaskHarnessConfig,
	TaskHarnessState,
	TaskResult,
	// Task execution
	TokenUsage,
	ValidationCheck,
	ValidationResult,
} from "./task-harness-types.js";
// Zod Schemas
export {
	// Retry & abort
	AgentAbortSignalSchema,
	AgentRecordingSchema,
	// Coding Agent
	CodingActionSchema,
	CodingAgentInputSchema,
	CodingAgentOutputSchema,
	CodingContextSchema,
	FailureRecordSchema,
	HarnessRunSchema,
	// Summary & recording
	HarnessSummarySchema,
	NarrativeEntrySchema,
	ParsedTaskSchema,
	// Parser Agent
	ParserAgentInputSchema,
	ParserAgentOutputSchema,
	ParserMetadataSchema,
	PhaseInfoSchema,
	RetryRecordSchema,
	ReviewAgentInputSchema,
	ReviewAgentOutputSchema,
	// Review Agent
	ReviewContextSchema,
	// Core task types
	TaskFlagsSchema,
	// Harness config & state
	TaskHarnessConfigSchema,
	TaskHarnessStateSchema,
	TaskResultSchema,
	// Task execution
	TokenUsageSchema,
	ValidationCheckSchema,
	ValidationResultSchema,
} from "./task-harness-types.js";
