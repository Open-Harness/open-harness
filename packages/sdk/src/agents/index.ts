/**
 * Agents Layer - Provider-agnostic agent system
 *
 * This module contains:
 * - IAgent interface: The core abstraction for typed agents
 * - BaseAnthropicAgent: Base class for Anthropic/Claude agents
 * - Concrete agents: CodingAgent, ReviewAgent, etc.
 */

// Core Types
export type {
	IAgent,
	IAgentRunner,
	RunnerOptions,
	AgentDefinition,
	AgentEvent,
	RunnerCallbacks,
	RunArgs,
} from "./types.js";

// Base Classes
export { BaseAnthropicAgent } from "./base-anthropic-agent.js";

// Concrete Agents
export { CodingAgent } from "./coding-agent.js";
export { ReviewAgent } from "./review-agent.js";

// Monologue Agent
export { AgentMonologue } from "./monologue.js";
