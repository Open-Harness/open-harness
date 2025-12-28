/**
 * Open Harness SDK - Provider-Agnostic Workflow SDK
 *
 * THREE-LAYER ARCHITECTURE:
 *
 * LAYER 1 - HARNESS (Step-Aware Orchestration):
 * - BaseHarness: Abstract class for step-aware execution
 * - Agent: Lightweight wrapper for step-aware agent logic
 * - PersistentState: State management with bounded context
 *
 * LAYER 2 - AGENTS (Provider-Agnostic Agent System):
 * - IAgent<TInput, TOutput>: Core interface for typed agents
 * - IAgentCallbacks: Unified callback interface
 *
 * LAYER 3 - RUNNERS (LLM Execution Infrastructure):
 * - IAgentRunner: Provider-agnostic runner interface
 * - DI Container: Dependency injection for all components
 *
 * For Anthropic/Claude provider, use @openharness/anthropic
 */

// ============================================
// HARNESS LAYER (Step-Aware Orchestration)
// ============================================

export type {
	AgentConfig,
	AgentRunParams,
	BackoffConfig,
	BackoffContext,
	Constraints,
	HarnessConfig,
	LoadedContext,
	PersistentStateConfig,
	StateDelta,
	Step,
	StepYield,
	TopologicalSortResult,
} from "./harness/index.js";
export {
	Agent,
	BaseHarness,
	calculateDelay,
	createBackoffContext,
	DEFAULT_BACKOFF_CONFIG,
	detectCycles,
	getReadyTasks,
	isRateLimitError,
	PersistentState,
	resolveDependencies,
	shouldRetry,
	sleep,
	TaskHarness,
	updateBackoffContext,
	validateDependencies,
	withBackoff,
} from "./harness/index.js";

// ============================================
// AGENT LAYER (Provider-Agnostic)
// ============================================

// Unified Callbacks (IAgentCallbacks is the primary callback interface)
export type {
	AgentError,
	AgentResult,
	AgentStartMetadata,
	IAgentCallbacks,
	NarrativeConfig,
	ProgressEvent,
	TokenUsage,
	ToolCallEvent,
	ToolResultEvent,
} from "./callbacks/index.js";

// Core Interface (re-exported from core)
export type { IAgent, RunnerOptions } from "@openharness/core";

// ============================================
// RUNNER LAYER (LLM Execution Infrastructure)
// ============================================

// Core Factories
export { createAgent, resetGlobalContainer, setGlobalContainer } from "./factory/agent-factory.js";
export {
	type CreateTaskHarnessOptions,
	createTaskHarness,
	createTestTaskHarness,
} from "./factory/harness-factory.js";
export { createWorkflow } from "./factory/workflow-builder.js";

// Task Management
export { TaskList } from "./workflow/task-list.js";

// ============================================
// TYPES
// ============================================

export type { Task, TaskStatus } from "./workflow/task-list.js";

// Task Harness Types (provider-agnostic)
export type {
	ParsedTask,
	ParserAgentInput,
	ParserAgentOutput,
	ParserMetadata,
	ReviewAgentInput,
	ReviewAgentOutput,
	ValidationResult,
	TaskFlags,
	PhaseInfo,
} from "./harness/task-harness-types.js";
export { ParserAgentOutputSchema, ReviewAgentOutputSchema } from "./harness/task-harness-types.js";

// Runner Callbacks
export type { RunnerCallbacks } from "./core/tokens.js";

// ============================================
// DI CONTAINER
// ============================================

export type { ContainerOptions } from "./core/container.js";
export { createContainer, createTestContainer } from "./core/container.js";

// EventBus
export { EventBus, type EventFilter, type EventListener, type SubscribeOptions } from "./core/event-bus.js";
// Token Interfaces
export type {
	IAgentRunner,
	IConfig,
	IEventBus,
	IMonologueConfig,
	IMonologueDecorator,
	IMonologueRunner,
	IPromptRegistry,
	IRecordingDecorator,
	IVault,
} from "./core/tokens.js";
// DI Tokens
export {
	IAgentRunnerToken,
	IAnthropicRunnerToken,
	IConfigToken,
	IEventBusToken,
	IMonologueDecoratorToken,
	IMonologueRunnerToken,
	IPromptRegistryToken,
	IRecordingDecoratorToken,
	IReplayRunnerToken,
	IVaultToken,
} from "./core/tokens.js";
// Monologue System Types
export type {
	AgentEvent as MonologueAgentEvent,
	IMonologueLLM,
	MonologueConfig,
	NarrativeAgentName,
	NarrativeEntry,
} from "./monologue/index.js";
export { DEFAULT_MONOLOGUE_PROMPT, IMonologueLLMToken, TERSE_PROMPT, VERBOSE_PROMPT } from "./monologue/index.js";
// Monologue System
export { Monologue, type MonologueOptions, setMonologueContainer } from "./monologue/index.js";

// ============================================
// FLUENT HARNESS API (007-fluent-harness-dx)
// ============================================

export type {
	AgentConstructor,
	ExecuteContext,
	HarnessConfig as FluentHarnessConfig,
	HarnessFactory,
	ResolvedAgents,
} from "./factory/define-harness.js";
// Level 2 & 3: Harness definition
export { defineHarness } from "./factory/define-harness.js";
export type {
	AgentConstructor as FluentAgentConstructor,
	ExecutableAgent,
	WrappedAgent,
} from "./factory/wrap-agent.js";
// Level 1: Single agent wrapper
export { wrapAgent } from "./factory/wrap-agent.js";
// Control flow helpers
export { createParallelHelper, createRetryHelper, type EmitFn, parallel, retry } from "./harness/control-flow.js";
// Event types for fluent API
export type {
	// Core events
	ErrorEvent as FluentErrorEvent,
	FluentEventHandler,
	FluentHarnessEvent,
	HarnessEventType,
	NarrativeEvent as FluentNarrativeEvent,
	// Parallel events
	ParallelCompleteEvent,
	ParallelEvent,
	ParallelItemCompleteEvent,
	ParallelOptions,
	ParallelStartEvent,
	PhaseEvent,
	// Retry events
	RetryAttemptEvent,
	RetryBackoffEvent,
	RetryEvent,
	RetryFailureEvent,
	RetryOptions,
	RetryStartEvent,
	RetrySuccessEvent,
	StepEvent,
	StepYield as FluentStepYield,
	TaskEvent,
} from "./harness/event-types.js";
// Type guard functions for fluent API
export {
	isErrorEvent,
	isNarrativeEvent,
	isParallelEvent,
	isPhaseEvent,
	isRetryEvent,
	isStepEvent,
	isTaskEvent,
} from "./harness/event-types.js";
export type { HarnessInstanceConfig, HarnessResult } from "./harness/harness-instance.js";
// Harness instance and result
export { HarnessInstance } from "./harness/harness-instance.js";

// ============================================
// UNIFIED EVENT SYSTEM (008-unified-event-system)
// ============================================

// DI Token
export { IUnifiedEventBusToken } from "./core/tokens.js";
// Core class and utilities
export { UnifiedEventBus } from "./core/unified-event-bus.js";
export { matchesFilter } from "./core/unified-events/filter.js";
// Types
export type {
	// Base event types (FR-004)
	AgentCompleteEvent,
	// Context types (FR-003)
	AgentContext,
	AgentStartEvent,
	AgentTextEvent,
	AgentThinkingEvent,
	AgentToolCompleteEvent,
	AgentToolStartEvent,
	BaseEvent,
	BaseEventPayload,
	// Enriched event (FR-002)
	EnrichedEvent,
	EventContext,
	// Event bus interface (FR-001)
	EventFilter as UnifiedEventFilter,
	ExtensionEvent,
	HarnessCompleteEvent,
	HarnessStartEvent,
	IUnifiedEventBus,
	NarrativeEvent as UnifiedNarrativeEvent,
	NarrativeImportance,
	PhaseCompleteEvent,
	PhaseContext,
	PhaseStartEvent,
	SessionAbortEvent,
	SessionPromptEvent,
	SessionReplyEvent,
	TaskCompleteEvent,
	TaskContext,
	TaskFailedEvent,
	TaskStartEvent,
	UnifiedEventListener,
	Unsubscribe,
} from "./core/unified-events/index.js";
// Type guards
export {
	isAgentEvent,
	isNarrativeEvent as isUnifiedNarrativeEvent,
	isSessionEvent,
	isWorkflowEvent,
} from "./core/unified-events/types.js";
// Renderer API (FR-005)
export {
	defineRenderer,
	type EventHandler as RendererEventHandler,
	type IUnifiedRenderer,
	type RenderContext,
	type RendererDefinition,
	RenderOutput,
	type RenderOutputConfig,
	type Spinner,
	toAttachment,
	type UnifiedRendererConfig,
} from "./harness/index.js";
