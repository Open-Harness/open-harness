/**
 * Anthropic Agents - Provider-specific agent implementations
 *
 * This module contains:
 * - BaseAnthropicAgent: Base class for Anthropic/Claude agents
 * - Concrete agents: CodingAgent, ReviewAgent, ParserAgent, PlannerAgent, ValidationReviewAgent
 */

// Base Classes
export { type AgentRunOptions, BaseAnthropicAgent } from "./base-anthropic-agent.js";

// Concrete Agents
export { CodingAgent, type CodingAgentOptions } from "./coding-agent.js";
export { ParserAgent } from "./parser-agent.js";
export { PlannerAgent, type PlannerAgentOptions, type PlannerResult, type Ticket } from "./planner-agent.js";
export { ReviewAgent, type ReviewAgentOptions, type ReviewResult } from "./review-agent.js";
// Core Types
export type {
	AgentDefinition,
	AgentEvent,
	IAgent,
	IAgentRunner,
	RunArgs,
	RunnerCallbacks,
	RunnerOptions,
} from "./types.js";
export { ValidationReviewAgent, type ValidationReviewAgentOptions } from "./validation-review-agent.js";
