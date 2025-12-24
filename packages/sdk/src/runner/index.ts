/**
 * Runner Layer - LLM execution infrastructure
 *
 * This module contains the runner implementations for different LLM providers.
 * Each runner implements IAgentRunner and maps provider-specific events to AgentEvent.
 */

// Runners
export { AnthropicRunner, LiveSDKRunner } from "./anthropic-runner.js";

// Base Agent (legacy - use BaseAnthropicAgent from agents/ instead)
export { BaseAgent, type StreamCallbacks } from "./base-agent.js";

// Event Mapping (shared between BaseAgent and BaseAnthropicAgent)
export { mapSdkMessageToEvents } from "./event-mapper.js";

// Models and Types
export {
	type AgentEvent,
	EventType,
	EventTypeConst,
	type SessionResult,
	type CompactData,
	type StatusData,
	type CodingResult,
	CodingResultSchema,
	CodingResultSdkSchema,
	zodToSdkSchema,
} from "./models.js";

// Prompts
export { PromptRegistry } from "./prompts.js";
