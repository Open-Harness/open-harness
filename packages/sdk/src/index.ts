/**
 * Open Harness SDK - Extensible Workflow SDK for Anthropic Agents
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
 * - BaseAnthropicAgent: Base class for Anthropic/Claude agents
 * - IAgentCallbacks: Unified callback interface
 *
 * LAYER 3 - RUNNERS (LLM Execution Infrastructure):
 * - AnthropicRunner: Production runner for Claude API
 * - ReplayRunner: Testing runner with recorded responses
 * - DI Container: Dependency injection for all components
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
// AGENT LAYER (Provider-Agnostic Agents)
// ============================================

// Base Classes
export { type AgentRunOptions, BaseAnthropicAgent } from "./agents/base-anthropic-agent.js";

// Concrete Agents
export { CodingAgent, type CodingAgentOptions } from "./agents/coding-agent.js";
export { ParserAgent } from "./agents/parser-agent.js";
export { PlannerAgent, type PlannerAgentOptions, type PlannerResult, type Ticket } from "./agents/planner-agent.js";
export { ReviewAgent, type ReviewAgentOptions, type ReviewResult } from "./agents/review-agent.js";
// Core Interface
export type { AgentDefinition, IAgent, RunnerOptions } from "./agents/types.js";
export { ValidationReviewAgent, type ValidationReviewAgentOptions } from "./agents/validation-review-agent.js";

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

// Primitives
export { withMonologue } from "./monologue/wrapper.js";

// Runners
export { AnthropicRunner } from "./runner/anthropic-runner.js";

// Task Management
export { TaskList } from "./workflow/task-list.js";

// ============================================
// TYPES
// ============================================

export type {
	AgentEvent,
	CodingResult,
	CompactData,
	SessionResult,
	StatusData,
} from "./runner/models.js";

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

// ============================================
// DEPRECATED EXPORTS (for backward compatibility)
// ============================================

/**
 * @deprecated Use IAgentCallbacks instead. Will be removed in next major version.
 */
export type { StreamCallbacks } from "./callbacks/types.js";
