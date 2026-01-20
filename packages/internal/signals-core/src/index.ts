/**
 * @internal/signals-core
 *
 * Core primitives for the Open Harness signal-based architecture.
 */

// Signal definition factory
export {
	type CreateFromDefinitionOptions,
	type DefineSignalConfig,
	defineSignal,
	type SignalDefinition,
} from "./define-signal.js";
// Harness types
export {
	HARNESS_SIGNALS,
	type Harness,
	type HarnessCapabilities,
	type HarnessInput,
	type HarnessOutput,
	type HarnessSignalPayloads,
	type Message,
	type RunContext,
	type TokenUsage,
	type ToolCall,
	type ToolDefinition,
	type ToolResult,
} from "./harness.js";
// Zod schemas for validation
export {
	HarnessEndPayloadSchema,
	HarnessErrorPayloadSchema,
	HarnessInputSchema,
	HarnessOutputSchema,
	HarnessStartPayloadSchema,
	MessageSchema,
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
export {
	type CreateSignalOptions,
	createSignal,
	isSignal,
	type Signal,
	type SignalSource,
} from "./signal.js";
