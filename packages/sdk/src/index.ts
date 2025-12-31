/**
 * Open Harness SDK - Provider-Agnostic Workflow SDK
 *
 * ARCHITECTURE:
 *
 * LAYER 1 - HARNESS (Fluent Orchestration):
 * - defineHarness: Factory for typed workflow harnesses
 * - wrapAgent: Single agent wrapper for quick tasks
 * - HarnessInstance: Runtime execution with event streaming
 *
 * LAYER 2 - AGENTS (Provider-Agnostic Agent System):
 * - IAgent<TInput, TOutput>: Core interface for typed agents
 * - IAgentCallbacks: Unified callback interface
 *
 * LAYER 3 - CHANNELS (Event Transport):
 * - defineChannel: Factory for event consumers (renderers, loggers, etc.)
 * - Transport: Bidirectional event interface
 *
 * For Anthropic/Claude provider, use @openharness/anthropic
 */

// ============================================
// HARNESS LAYER (Fluent Orchestration)
// ============================================

// Core Utilities
export type {
	BackoffConfig,
	BackoffContext,
	TopologicalSortResult,
} from "./harness/index.js";
export {
	calculateDelay,
	createBackoffContext,
	DEFAULT_BACKOFF_CONFIG,
	detectCycles,
	getReadyTasks,
	isRateLimitError,
	resolveDependencies,
	shouldRetry,
	sleep,
	updateBackoffContext,
	validateDependencies,
	withBackoff,
} from "./harness/index.js";

// ============================================
// AGENT LAYER (Provider-Agnostic)
// ============================================

// Core Interface (re-exported from core)
export type { IAgent, RunnerOptions } from "@openharness/core";
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

// ============================================
// FACTORY LAYER
// ============================================

// Core Factories
export { createAgent, resetGlobalContainer, setGlobalContainer } from "./factory/agent-factory.js";

// Task Management
export { TaskList } from "./workflow/task-list.js";

// ============================================
// TYPES
// ============================================

// Runner Callbacks
export type { RunnerCallbacks } from "./core/tokens.js";
export type { Task, TaskStatus } from "./workflow/task-list.js";

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
// Monologue System
export {
	DEFAULT_MONOLOGUE_PROMPT,
	IMonologueLLMToken,
	Monologue,
	type MonologueOptions,
	setMonologueContainer,
	TERSE_PROMPT,
	VERBOSE_PROMPT,
} from "./monologue/index.js";

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

// ============================================
// CHANNEL SYSTEM
// ============================================

// Channel API
export {
	type ChannelConfig,
	type ChannelContext,
	type ChannelDefinition,
	type ChannelEventHandler,
	createChannel,
	defineChannel,
	type IChannel,
	RenderOutput,
	type RenderOutputConfig,
	type Spinner,
} from "./harness/index.js";
