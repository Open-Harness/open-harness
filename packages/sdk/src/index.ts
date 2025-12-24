/**
 * bun-vi SDK - Extensible Workflow SDK for Anthropic Agents
 *
 * Core Primitives:
 * - Agent: Prompt template + state + custom logic
 * - Workflow: Orchestrates agents with task management
 * - Task: Work unit in workflow task list
 * - Monologue: Stream abstraction - turns tool noise into narrative
 */

// ============================================
// Core Factories
// ============================================

export { createAgent } from "./factory/agent-factory.js";
export { createWorkflow } from "./factory/workflow-builder.js";

// ============================================
// Primitives
// ============================================

export { withMonologue } from "./monologue/wrapper.js";
export { TaskList } from "./workflow/task-list.js";

// ============================================
// Base Classes (for advanced users)
// ============================================

export type { StreamCallbacks } from "./runner/base-agent.js";
export { BaseAgent } from "./runner/base-agent.js";

// ============================================
// Built-in Agents (examples)
// ============================================

export { CodingAgent } from "./agents/coding-agent.js";
export { ReviewAgent } from "./agents/review-agent.js";

// ============================================
// Types
// ============================================

export type {
	AgentEvent,
	CodingResult,
	CompactData,
	SessionResult,
	StatusData,
} from "./runner/models.js";

export type {
	Task,
	TaskStatus,
} from "./workflow/task-list.js";

// ============================================
// Harness Primitives
// ============================================

export * from "./harness/index.js";

// ============================================
// Internal (for testing/advanced usage)
// ============================================

export type { ContainerOptions } from "./core/container.js";
export { createContainer } from "./core/container.js";
