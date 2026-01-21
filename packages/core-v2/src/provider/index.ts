/**
 * Provider Module - Public Exports
 *
 * This module re-exports consumer-facing types for LLM providers.
 * NO Effect types are exposed here.
 *
 * @module @core-v2/provider
 */

// Types
export type {
	ClaudeProviderConfig,
	ProviderErrorCode,
	ProviderInfo,
	ProviderMessage,
	ProviderType,
	PublicLLMProvider,
	QueryOptions,
	QueryResult,
	StreamChunk,
} from "./Provider.js";

// Error class (consumer-facing, no Effect)
export { ProviderError } from "./Provider.js";
