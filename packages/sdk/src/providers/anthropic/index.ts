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
	BaseAnthropicAgent,
	CodingAgent,
	ParserAgent,
	PlannerAgent,
	ReviewAgent,
	ValidationReviewAgent,
	type AgentRunOptions,
	type CodingAgentOptions,
	type PlannerAgentOptions,
	type PlannerResult,
	type ReviewAgentOptions,
	type ReviewResult,
	type Ticket,
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
	CodingResultSchema,
	CodingResultSdkSchema,
	EventType,
	EventTypeConst,
	zodToSdkSchema,
	type AgentEvent as RunnerAgentEvent,
	type CodingResult,
	type CompactData,
	type JSONSchemaFormat,
	type SessionResult,
	type StatusData,
} from "./runner/models.js";
export { PromptRegistry } from "./runner/prompts.js";

// ============================================================================
// Monologue (placeholder - will be added in Phase 3)
// ============================================================================

// export { AnthropicMonologue } from "./monologue/decorator.js";
// export { AnthropicMonologueGenerator } from "./monologue/generator.js";
// export type { MonologueConfig, MonologueMetadata } from "./monologue/types.js";
