/**
 * Agents Layer - Provider-agnostic agent system
 *
 * This module contains:
 * - IAgent interface: The core abstraction for typed agents
 * - BaseAnthropicAgent: Base class for Anthropic/Claude agents
 * - Concrete agents: CodingAgent, ReviewAgent, etc.
 */

// Base Classes
export { BaseAnthropicAgent } from "./base-anthropic-agent.js";
// Concrete Agents
export { CodingAgent } from "./coding-agent.js";
// Monologue Agent
export { AgentMonologue } from "./monologue.js";
export { ReviewAgent } from "./review-agent.js";
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
