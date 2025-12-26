/**
 * Anthropic Provider - Claude/Anthropic-specific implementations
 *
 * This module exports all Anthropic-specific components:
 * - Agents: CodingAgent, ReviewAgent, ParserAgent, etc.
 * - Runner: AnthropicRunner for production Claude API calls
 * - Monologue: (planned) AnthropicMonologue decorator for narratives
 *
 * @module providers/anthropic
 */

// ============================================================================
// Agents
// ============================================================================

export {
	type AgentRunOptions,
	BaseAnthropicAgent,
	CodingAgent,
	type CodingAgentOptions,
	ParserAgent,
	PlannerAgent,
	type PlannerAgentOptions,
	type PlannerResult,
	ReviewAgent,
	type ReviewAgentOptions,
	type ReviewResult,
	type Ticket,
	ValidationReviewAgent,
	type ValidationReviewAgentOptions,
} from "./agents/index.js";

// Agent types
export type {
	AgentDefinition,
	AgentEvent,
	IAgent,
	IAgentRunner as IAgentRunnerType,
	RunArgs,
	RunnerCallbacks as RunnerCallbacksType,
	RunnerOptions,
} from "./agents/types.js";

// ============================================================================
// Runner
// ============================================================================

export { AnthropicRunner, LiveSDKRunner } from "./runner/anthropic-runner.js";
export { mapSdkMessageToEvents } from "./runner/event-mapper.js";
export {
	type AgentEvent as RunnerAgentEvent,
	type CodingResult,
	CodingResultSchema,
	CodingResultSdkSchema,
	type CompactData,
	EventType,
	EventTypeConst,
	type JSONSchemaFormat,
	type SessionResult,
	type StatusData,
	zodToSdkSchema,
} from "./runner/models.js";
export { PromptRegistry } from "./runner/prompts.js";

// ============================================================================
// Monologue (placeholder - will be added in Phase 3)
// ============================================================================

// export { AnthropicMonologue } from "./monologue/decorator.js";
// export { AnthropicMonologueGenerator } from "./monologue/generator.js";
// export type { MonologueConfig, MonologueMetadata } from "./monologue/types.js";
