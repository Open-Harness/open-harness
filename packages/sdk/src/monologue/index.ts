/**
 * Monologue System - LLM-powered narrative generation for agents
 *
 * This module provides automatic narrative generation from agent events.
 * Use the @Monologue decorator to enable narratives without code changes.
 */

// LLM Implementation (T013)
export { AnthropicMonologueLLM } from "./anthropic-llm.js";
export type { MonologueOptions } from "./monologue-decorator.js";
// Decorator (T021)
export { Monologue, setMonologueContainer } from "./monologue-decorator.js";
export type { MonologueCallback, MonologueServiceOptions } from "./monologue-service.js";
// Service (T014)
export { createMonologueService, MonologueService } from "./monologue-service.js";
// Prompts (T007)
export { DEFAULT_MONOLOGUE_PROMPT, TERSE_PROMPT, VERBOSE_PROMPT } from "./prompts.js";
// DI Tokens (T006)
export { IMonologueConfigToken, IMonologueLLMToken, IMonologueServiceToken } from "./tokens.js";
// Types (T004, T005)
export type {
	AgentEvent,
	AgentEventPayload,
	AgentEventType,
	CompletionPayload,
	IMonologueLLM,
	IMonologueService,
	MonologueConfig,
	MonologueDecoratorOptions,
	NarrativeAgentName,
	NarrativeEntry,
	NarrativeMetadata,
	TextPayload,
	ThinkingPayload,
	ToolCallPayload,
	ToolResultPayload,
} from "./types.js";
export {
	AgentEventSchema,
	DEFAULT_MONOLOGUE_CONFIG,
	MonologueConfigSchema,
	NarrativeEntrySchema,
	NarrativeMetadataSchema,
} from "./types.js";
