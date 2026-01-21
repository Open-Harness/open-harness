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

// AgentRegistry Service types (consumer-facing only - NO Effect types)
export type { AgentRegistryErrorCode, PublicAgentRegistry } from "./AgentService.js";

// AgentRegistry Error class (needed for instanceof checks)
export { AgentRegistryError } from "./AgentService.js";
