/**
 * @openharness/anthropic
 *
 * Anthropic/Claude provider implementation for the Open Harness SDK.
 *
 * This package contains all Anthropic-specific code:
 * - AnthropicRunner: LLM execution via Claude Agent SDK
 * - Agents: CodingAgent, ReviewAgent, ParserAgent, etc.
 * - Recording: Replay and recording system for testing
 *
 * @module @openharness/anthropic
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

// Agent types (re-export for convenience)
export type {
	AgentDefinition,
	AgentEvent as AnthropicAgentEvent,
	IAgent,
	IAgentRunner as IAnthropicAgentRunner,
	RunArgs as AnthropicRunArgs,
	RunnerCallbacks as AnthropicRunnerCallbacks,
	RunnerOptions as AnthropicRunnerOptions,
} from "./agents/types.js";

// ============================================================================
// Runner
// ============================================================================

export { AnthropicRunner } from "./runner/anthropic-runner.js";
export { mapSdkMessageToEvents, mapSdkMessageToUnifiedEvents } from "./runner/event-mapper.js";
export {
	type AgentEvent,
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
// Recording
// ============================================================================

export { ReplayRunner } from "./recording/replay-runner.js";
export { Recorder, RecordingFactory } from "./recording/recording-factory.js";
export { Vault } from "./recording/vault.js";
export { Record, setDecoratorContainer, setRecordingFactoryToken, type IContainer } from "./recording/decorators.js";
export type {
	IRecorder,
	IRecordingFactory,
	IVault,
	IVaultSession,
	RecordedSession,
} from "./recording/types.js";

// ============================================================================
// Monologue
// ============================================================================

export { AnthropicMonologueLLM } from "./monologue/anthropic-llm.js";
