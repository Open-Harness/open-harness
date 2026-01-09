/**
 * Zod Schemas for Provider Types
 *
 * These schemas enable runtime validation of provider inputs/outputs,
 * useful for:
 * - Validating user-provided inputs
 * - Validating recorded fixtures
 * - Testing provider implementations
 */

import { z } from "zod";

// ============================================================================
// Message Schemas
// ============================================================================

export const MessageSchema = z.object({
	role: z.enum(["user", "assistant", "system"]),
	content: z.string(),
});

export const ToolDefinitionSchema = z.object({
	name: z.string(),
	description: z.string(),
	inputSchema: z.record(z.unknown()),
});

export const ToolResultSchema = z.object({
	toolName: z.string(),
	result: z.unknown(),
	error: z.string().optional(),
});

// ============================================================================
// Provider Input Schema
// ============================================================================

export const ProviderInputSchema = z.object({
	system: z.string().optional(),
	messages: z.array(MessageSchema),
	tools: z.array(ToolDefinitionSchema).optional(),
	toolResults: z.array(ToolResultSchema).optional(),
	sessionId: z.string().optional(),
	maxTokens: z.number().positive().optional(),
	temperature: z.number().min(0).max(1).optional(),
});

// ============================================================================
// Provider Output Schema
// ============================================================================

export const ToolCallSchema = z.object({
	id: z.string(),
	name: z.string(),
	input: z.unknown(),
});

export const TokenUsageSchema = z.object({
	inputTokens: z.number().nonnegative(),
	outputTokens: z.number().nonnegative(),
	totalTokens: z.number().nonnegative(),
});

export const ProviderOutputSchema = z.object({
	content: z.string(),
	toolCalls: z.array(ToolCallSchema).optional(),
	sessionId: z.string().optional(),
	usage: TokenUsageSchema.optional(),
	stopReason: z.enum(["end", "max_tokens", "tool_use", "error"]).optional(),
});

// ============================================================================
// Signal Schemas
// ============================================================================

export const SignalSourceSchema = z.object({
	agent: z.string().optional(),
	provider: z.string().optional(),
	parent: z.string().optional(),
});

export const SignalSchema = z.object({
	name: z.string(),
	payload: z.unknown(),
	timestamp: z.string().datetime(),
	source: SignalSourceSchema.optional(),
});

// ============================================================================
// Provider Signal Payload Schemas
// ============================================================================

export const ProviderStartPayloadSchema = z.object({
	input: ProviderInputSchema,
});

export const ProviderEndPayloadSchema = z.object({
	output: ProviderOutputSchema,
	durationMs: z.number().nonnegative(),
});

export const ProviderErrorPayloadSchema = z.object({
	code: z.string(),
	message: z.string(),
	recoverable: z.boolean(),
});

export const TextDeltaPayloadSchema = z.object({
	content: z.string(),
});

export const TextCompletePayloadSchema = z.object({
	content: z.string(),
});

export const ThinkingDeltaPayloadSchema = z.object({
	content: z.string(),
});

export const ThinkingCompletePayloadSchema = z.object({
	content: z.string(),
});

export const ToolCallPayloadSchema = z.object({
	id: z.string(),
	name: z.string(),
	input: z.unknown(),
});

export const ToolResultPayloadSchema = z.object({
	id: z.string(),
	name: z.string(),
	result: z.unknown(),
	error: z.string().optional(),
});

// ============================================================================
// Type Inference Helpers
// ============================================================================

export type MessageInput = z.input<typeof MessageSchema>;
export type ToolDefinitionInput = z.input<typeof ToolDefinitionSchema>;
export type ProviderInputType = z.input<typeof ProviderInputSchema>;
export type ProviderOutputType = z.input<typeof ProviderOutputSchema>;
export type SignalInput = z.input<typeof SignalSchema>;
