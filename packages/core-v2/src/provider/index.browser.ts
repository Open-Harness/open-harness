/**
 * Provider Module - Browser-Safe Exports
 *
 * This module re-exports consumer-facing types for LLM providers.
 * NO Node.js dependencies are included here.
 *
 * NOTE: makeClaudeProviderService is NOT exported here because it
 * depends on @anthropic-ai/claude-agent-sdk which uses Node.js APIs.
 * Use the server entry point for the full provider implementation.
 *
 * @module @core-v2/provider
 */

// Types only - no runtime code that depends on Node.js
export type {
	ClaudeProviderConfig,
	LLMProviderService,
	ProviderErrorCode,
	ProviderInfo,
	ProviderMessage,
	ProviderType,
	PublicLLMProvider,
	QueryOptions,
	QueryResult,
	StreamChunk,
} from "./Provider.js";

// Error class is safe - no Node.js dependencies
export { ProviderError } from "./Provider.js";

// NOTE: makeClaudeProviderService is NOT exported here
// Import from "@open-harness/core-v2" server entry point for LLM providers
