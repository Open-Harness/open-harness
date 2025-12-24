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
	Constraints,
	HarnessConfig,
	LoadedContext,
	PersistentStateConfig,
	StateDelta,
	Step,
	StepYield,
} from "./harness/index.js";
export { Agent, BaseHarness, PersistentState } from "./harness/index.js";

// ============================================
// AGENT LAYER (Provider-Agnostic Agents)
// ============================================

// Base Classes
export { BaseAnthropicAgent } from "./agents/base-anthropic-agent.js";
// Concrete Agents
export { CodingAgent } from "./agents/coding-agent.js";
export { PlannerAgent, type PlannerResult, type Ticket } from "./agents/planner-agent.js";
export { ReviewAgent, type ReviewResult } from "./agents/review-agent.js";
// Core Interface
export type { AgentDefinition, IAgent, RunnerOptions } from "./agents/types.js";
// Unified Callbacks
export type {
	AgentError,
	AgentResult,
	AgentStartMetadata,
	IAgentCallbacks,
	ProgressEvent,
	TokenUsage,
	ToolCallEvent,
	ToolResultEvent,
} from "./callbacks/index.js";

// ============================================
// RUNNER LAYER (LLM Execution Infrastructure)
// ============================================

// Core Factories
export { createAgent } from "./factory/agent-factory.js";
export { createWorkflow } from "./factory/workflow-builder.js";
// Primitives
export { withMonologue } from "./monologue/wrapper.js";
// Runners
export { AnthropicRunner } from "./runner/anthropic-runner.js";
// Legacy Base Classes (use BaseAnthropicAgent instead)
export { BaseAgent, type StreamCallbacks } from "./runner/base-agent.js";
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
export { createContainer } from "./core/container.js";
export type {
	IAgentRunner,
	IConfig,
	IEventBus,
	IVault,
} from "./core/tokens.js";
// DI Tokens
export {
	IAgentRunnerToken,
	IAnthropicRunnerToken,
	IConfigToken,
	IEventBusToken,
	IReplayRunnerToken,
	IVaultToken,
} from "./core/tokens.js";
