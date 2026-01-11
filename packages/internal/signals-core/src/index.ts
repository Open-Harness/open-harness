/**
 * @internal/signals-core
 *
 * Core primitives for the Open Harness signal-based architecture.
 */

// Provider types
export {
	type Message,
	PROVIDER_SIGNALS,
	type Provider,
	type ProviderCapabilities,
	type ProviderInput,
	type ProviderOutput,
	type ProviderSignalPayloads,
	type RunContext,
	type TokenUsage,
	type ToolCall,
	type ToolDefinition,
	type ToolResult,
} from "./provider.js";
// Zod schemas for validation
export {
	MessageSchema,
	ProviderEndPayloadSchema,
	ProviderErrorPayloadSchema,
	ProviderInputSchema,
	ProviderOutputSchema,
	ProviderStartPayloadSchema,
	SignalSchema,
	SignalSourceSchema,
	TextCompletePayloadSchema,
	TextDeltaPayloadSchema,
	ThinkingCompletePayloadSchema,
	ThinkingDeltaPayloadSchema,
	TokenUsageSchema,
	ToolCallPayloadSchema,
	ToolCallSchema,
	ToolDefinitionSchema,
	ToolResultPayloadSchema,
	ToolResultSchema,
} from "./schemas.js";
// Signal primitives
export { createSignal, isSignal, type Signal, type SignalSource } from "./signal.js";
