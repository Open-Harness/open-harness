/**
 * Zod Schemas for Harness Types
 *
 * These schemas enable runtime validation of harness inputs/outputs,
 * useful for:
 * - Validating user-provided inputs
 * - Validating recorded fixtures
 * - Testing harness implementations
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
// Harness Input Schema
// ============================================================================

export const HarnessInputSchema = z.object({
	system: z.string().optional(),
	messages: z.array(MessageSchema),
	tools: z.array(ToolDefinitionSchema).optional(),
	toolResults: z.array(ToolResultSchema).optional(),
	sessionId: z.string().optional(),
	maxTokens: z.number().positive().optional(),
	temperature: z.number().min(0).max(1).optional(),
});

// ============================================================================
// Harness Output Schema
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

export const HarnessOutputSchema = z.object({
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
	harness: z.string().optional(),
	parent: z.string().optional(),
});

export const SignalSchema = z.object({
	id: z.string(),
	name: z.string(),
	payload: z.unknown(),
	timestamp: z.string().datetime(),
	source: SignalSourceSchema.optional(),
});

// ============================================================================
// Harness Signal Payload Schemas
// ============================================================================

export const HarnessStartPayloadSchema = z.object({
	input: HarnessInputSchema,
});

export const HarnessEndPayloadSchema = z.object({
	output: HarnessOutputSchema,
	durationMs: z.number().nonnegative(),
});

export const HarnessErrorPayloadSchema = z.object({
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
export type HarnessInputType = z.input<typeof HarnessInputSchema>;
export type HarnessOutputType = z.input<typeof HarnessOutputSchema>;
export type SignalInput = z.input<typeof SignalSchema>;
