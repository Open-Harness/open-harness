/**
 * Monologue System - LLM-powered narrative generation for agents
 *
 * This module provides automatic narrative generation from agent events.
 * Use the @Monologue decorator to enable narratives without code changes.
 */
export type { MonologueOptions } from "./monologue-decorator.js";
export { Monologue, setMonologueContainer } from "./monologue-decorator.js";
export type { MonologueCallback, MonologueServiceOptions } from "./monologue-service.js";
export { createMonologueService, MonologueService } from "./monologue-service.js";
export { DEFAULT_MONOLOGUE_PROMPT, TERSE_PROMPT, VERBOSE_PROMPT } from "./prompts.js";
export { IMonologueConfigToken, IMonologueLLMToken, IMonologueServiceToken } from "./tokens.js";
export type { AgentEvent, AgentEventPayload, AgentEventType, CompletionPayload, IMonologueLLM, IMonologueService, MonologueConfig, MonologueDecoratorOptions, NarrativeAgentName, NarrativeEntry, NarrativeMetadata, TextPayload, ThinkingPayload, ToolCallPayload, ToolResultPayload, } from "./types.js";
export { AgentEventSchema, DEFAULT_MONOLOGUE_CONFIG, MonologueConfigSchema, NarrativeEntrySchema, NarrativeMetadataSchema, } from "./types.js";
