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

// ============================================================================
// Renderer System (003-harness-renderer)
// ============================================================================

// Base Renderer
export { BaseHarnessRenderer } from "./base-renderer.js";
// Composite Renderer (multiple renderers)
export { CompositeRenderer } from "./composite-renderer.js";
// Console Renderer
export { ConsoleRenderer } from "./console-renderer.js";
// Event Protocol
export {
	type AgentName,
	type HarnessCompleteEvent,
	type HarnessErrorEvent,
	type HarnessEvent,
	type HarnessStartEvent,
	isLifecycleEvent,
	isPhaseEvent,
	isTaskEvent,
	isValidationEvent,
	type MonologueMetadata,
	type NarrativeEntry as EventNarrativeEntry,
	type NarrativeImportance,
	type PhaseCompleteEvent,
	type PhaseStartEvent,
	type TaskCompleteEvent,
	type TaskFailedEvent,
	type TaskNarrativeEvent,
	type TaskRetryEvent,
	type TaskSkippedEvent,
	type TaskStartEvent,
	type ValidationCompleteEvent,
	type ValidationFailedEvent,
	type ValidationStartEvent,
	type VerbosityLevel,
} from "./event-protocol.js";
// Renderer Interface
export type {
	IHarnessRenderer,
	PhaseRenderState,
	RendererConfig,
	RenderState,
	TaskDisplayStatus,
	TaskRenderState,
	ValidationDisplayStatus,
} from "./renderer-interface.js";

// Replay Controller
export { ReplayController, type ReplayControllerConfig } from "./replay-controller.js";

// ============================================================================
// Unified Event System Renderer (008-unified-event-system)
// ============================================================================

// Declarative Renderer API
export {
	defineRenderer,
	type EventHandler,
	type IUnifiedRenderer,
	type RenderContext,
	type RendererConfig as UnifiedRendererConfig,
	type RendererDefinition,
} from "./define-renderer.js";

// Render Output Helpers
export { RenderOutput, type RenderOutputConfig, type Spinner } from "./render-output.js";
