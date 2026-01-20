/**
 * Agent Module Public API
 *
 * Re-exports agent primitives for consumer use.
 * NO Effect internals are exported here.
 *
 * @module @core-v2/agent
 */

// Types
export type { Agent, AgentOptions, AgentRegistry, PromptPart, PromptTemplate } from "./Agent.js";

// Factory and utilities
export {
	agent,
	createAgentRegistry,
	findMatchingAgents,
	MissingOutputSchemaError,
	shouldActivate,
} from "./Agent.js";
