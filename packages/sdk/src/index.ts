/**
 * Open Harness SDK - Extensible Workflow SDK for Anthropic Agents
 *
 * TWO-LAYER ARCHITECTURE:
 *
 * LAYER 1 - HARNESS (Step-Aware Agents):
 * - BaseHarness: Abstract class for step-aware execution
 * - Agent: Lightweight wrapper for step-aware agent logic
 * - PersistentState: State management with bounded context
 *
 * LAYER 2 - INTERNAL (LLM Execution Infrastructure):
 * - createAgent: Factory for creating agents (built-in, config, class-based)
 * - createWorkflow: Factory for creating workflows
 * - withMonologue: Wrapper for narrative generation
 * - BaseAgent: Foundation class with DI, callbacks, EventBus
 * - TaskList: Workflow task management
 */

// ============================================
// HARNESS LAYER (Step-Aware Execution)
// ============================================

export { BaseHarness, Agent, PersistentState } from "./harness/index.js";

export type {
	Step,
	StepYield,
	StateDelta,
	Constraints,
	LoadedContext,
	HarnessConfig,
	PersistentStateConfig,
	AgentConfig,
	AgentRunParams,
} from "./harness/index.js";

// ============================================
// INTERNAL LAYER (LLM Execution Infrastructure)
// ============================================

// Core Factories
export { createAgent } from "./factory/agent-factory.js";
export { createWorkflow } from "./factory/workflow-builder.js";

// Primitives
export { withMonologue } from "./monologue/wrapper.js";
export { TaskList } from "./workflow/task-list.js";

// Base Classes (for extension)
export { BaseAgent, type StreamCallbacks } from "./runner/base-agent.js";

// Built-in Agents
export { CodingAgent } from "./agents/coding-agent.js";
export { ReviewAgent } from "./agents/review-agent.js";

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
// ADVANCED (Container Access)
// ============================================

export type { ContainerOptions } from "./core/container.js";
export { createContainer } from "./core/container.js";
