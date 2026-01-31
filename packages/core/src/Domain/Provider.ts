/**
 * Provider types - AI provider abstractions for Agent SDKs.
 *
 * Each provider wraps an SDK (Anthropic, Codex, etc.) and exposes
 * a streaming interface for agent execution.
 *
 * @module
 */

import { Schema } from "effect"
import type { Stream } from "effect"
import type { z } from "zod"

import type { ProviderError } from "./Errors.js"

// ─────────────────────────────────────────────────────────────────
// Agent Provider (Public API)
// ─────────────────────────────────────────────────────────────────

/**
 * Provider execution mode - TWO modes only.
 * - "live": Call API and record results
 * - "playback": Use recorded results, never call API
 *
 * Note: Mode is set at server level via ProviderModeContext,
 * NOT configured per-provider. This ensures consistency.
 */
export type ProviderMode = "live" | "playback"

/**
 * Agent Provider - abstraction for Agent SDKs (Anthropic, Codex, etc.)
 *
 * Returns Effect Stream (not AsyncIterable) to preserve structured concurrency.
 * The stream is consumed directly - no buffering or conversion.
 *
 * Mode is NOT on the provider - it's read from ProviderModeContext.
 * Recording happens at server level (NOT as a wrapper).
 *
 * IMPORTANT: No generic R parameter. Providers always return R = never.
 * Recording is an ORCHESTRATION concern, not a provider concern.
 */
export interface AgentProvider {
  /** Provider name (e.g., "anthropic", "codex") */
  readonly name: string

  /** Model identifier (e.g., "claude-sonnet-4-5") */
  readonly model: string

  /** Provider-specific configuration for hashing in recording/playback (ADR-010) */
  readonly config?: Record<string, unknown>

  /** Stream agent execution */
  readonly stream: (options: ProviderRunOptions) => Stream.Stream<AgentStreamEvent, ProviderError>
}

/**
 * Options for running an agent provider.
 */
export interface ProviderRunOptions {
  readonly prompt: string
  readonly tools?: ReadonlyArray<unknown>
  readonly outputSchema?: z.ZodType<unknown>
  /** Provider-specific options (model, extendedThinking, etc.) */
  readonly providerOptions?: Record<string, unknown>
  /**
   * Provider session ID to resume from.
   * When provided, the provider will continue an existing conversation thread.
   */
  readonly resume?: string
  /**
   * Abort signal for cancelling the provider request.
   * When aborted, the SDK cancels the HTTP request.
   */
  readonly abortSignal?: AbortSignal
}

/**
 * Result from a completed agent run.
 */
export interface AgentRunResult {
  readonly text?: string
  readonly thinking?: string
  readonly output?: unknown
  readonly sessionId?: string
  readonly usage?: {
    readonly inputTokens: number
    readonly outputTokens: number
  }
  readonly stopReason: "end_turn" | "tool_use" | "max_tokens"
}

/**
 * Events streamed during agent execution.
 */
export type AgentStreamEvent =
  | { readonly _tag: "TextDelta"; readonly delta: string }
  | { readonly _tag: "TextComplete"; readonly text: string }
  | { readonly _tag: "ThinkingDelta"; readonly delta: string }
  | { readonly _tag: "ThinkingComplete"; readonly thinking: string }
  | { readonly _tag: "ToolCall"; readonly toolId: string; readonly toolName: string; readonly input: unknown }
  | { readonly _tag: "ToolResult"; readonly toolId: string; readonly output: unknown; readonly isError: boolean }
  | { readonly _tag: "Stop"; readonly reason: "end_turn" | "tool_use" | "max_tokens" }
  | { readonly _tag: "Usage"; readonly inputTokens: number; readonly outputTokens: number }
  /**
   * SessionInit event - emitted when provider session ID is captured.
   *
   * This comes from the SDK's init message (type='system', subtype='init')
   * at the START of the stream, and is used for resume functionality.
   */
  | { readonly _tag: "SessionInit"; readonly sessionId: string }
  | {
    readonly _tag: "Result"
    readonly output: unknown
    readonly stopReason: "end_turn" | "tool_use" | "max_tokens"
    readonly text?: string
    readonly thinking?: string
    readonly usage?: { readonly inputTokens: number; readonly outputTokens: number }
    readonly sessionId?: string
  }

// ─────────────────────────────────────────────────────────────────
// Effect Schemas for Validation at System Boundaries
// ─────────────────────────────────────────────────────────────────

const StopReasonSchema = Schema.Literal("end_turn", "tool_use", "max_tokens")

const UsageSchema = Schema.Struct({
  inputTokens: Schema.Number,
  outputTokens: Schema.Number
})

/**
 * Schema for AgentRunResult - validates structure from JSON.parse.
 */
export const AgentRunResultSchema = Schema.Struct({
  text: Schema.optionalWith(Schema.String, { exact: true }),
  thinking: Schema.optionalWith(Schema.String, { exact: true }),
  output: Schema.optionalWith(Schema.Unknown, { exact: true }),
  sessionId: Schema.optionalWith(Schema.String, { exact: true }),
  usage: Schema.optionalWith(UsageSchema, { exact: true }),
  stopReason: StopReasonSchema
})

/**
 * Schema for AgentStreamEvent union type.
 * Each variant is validated by its _tag discriminator.
 */
export const AgentStreamEventSchema = Schema.Union(
  Schema.Struct({ _tag: Schema.Literal("TextDelta"), delta: Schema.String }),
  Schema.Struct({ _tag: Schema.Literal("TextComplete"), text: Schema.String }),
  Schema.Struct({ _tag: Schema.Literal("ThinkingDelta"), delta: Schema.String }),
  Schema.Struct({ _tag: Schema.Literal("ThinkingComplete"), thinking: Schema.String }),
  Schema.Struct({
    _tag: Schema.Literal("ToolCall"),
    toolId: Schema.String,
    toolName: Schema.String,
    input: Schema.Unknown
  }),
  Schema.Struct({
    _tag: Schema.Literal("ToolResult"),
    toolId: Schema.String,
    output: Schema.Unknown,
    isError: Schema.Boolean
  }),
  Schema.Struct({ _tag: Schema.Literal("Stop"), reason: StopReasonSchema }),
  Schema.Struct({ _tag: Schema.Literal("Usage"), inputTokens: Schema.Number, outputTokens: Schema.Number }),
  Schema.Struct({ _tag: Schema.Literal("SessionInit"), sessionId: Schema.String }),
  Schema.Struct({
    _tag: Schema.Literal("Result"),
    output: Schema.Unknown,
    stopReason: StopReasonSchema,
    text: Schema.optionalWith(Schema.String, { exact: true }),
    thinking: Schema.optionalWith(Schema.String, { exact: true }),
    usage: Schema.optionalWith(UsageSchema, { exact: true }),
    sessionId: Schema.optionalWith(Schema.String, { exact: true })
  })
)

/**
 * Decode unknown value to AgentRunResult with validation.
 * Returns Option - None if invalid, Some if valid.
 */
export const decodeAgentRunResult = Schema.decodeUnknownOption(AgentRunResultSchema)

/**
 * Decode unknown value to AgentStreamEvent with validation.
 * Returns Option - None if invalid, Some if valid.
 */
export const decodeAgentStreamEvent = Schema.decodeUnknownOption(AgentStreamEventSchema)

// ─────────────────────────────────────────────────────────────────
// Factory Functions for Type-Safe Construction
// ─────────────────────────────────────────────────────────────────

/** Create a TextDelta event */
export const makeTextDelta = (delta: string): AgentStreamEvent => ({ _tag: "TextDelta", delta })

/** Create a TextComplete event */
export const makeTextComplete = (text: string): AgentStreamEvent => ({ _tag: "TextComplete", text })

/** Create a ThinkingDelta event */
export const makeThinkingDelta = (delta: string): AgentStreamEvent => ({ _tag: "ThinkingDelta", delta })

/** Create a ThinkingComplete event */
export const makeThinkingComplete = (thinking: string): AgentStreamEvent => ({ _tag: "ThinkingComplete", thinking })

/** Create a ToolCall event */
export const makeToolCall = (toolId: string, toolName: string, input: unknown): AgentStreamEvent => ({
  _tag: "ToolCall",
  toolId,
  toolName,
  input
})

/** Create a ToolResult event */
export const makeToolResult = (toolId: string, output: unknown, isError: boolean): AgentStreamEvent => ({
  _tag: "ToolResult",
  toolId,
  output,
  isError
})

/** Create a Stop event */
export const makeStop = (reason: "end_turn" | "tool_use" | "max_tokens"): AgentStreamEvent => ({
  _tag: "Stop",
  reason
})

/** Create a Usage event */
export const makeUsage = (inputTokens: number, outputTokens: number): AgentStreamEvent => ({
  _tag: "Usage",
  inputTokens,
  outputTokens
})

/** Create a SessionInit event */
export const makeSessionInit = (sessionId: string): AgentStreamEvent => ({ _tag: "SessionInit", sessionId })

/** Create a Result event */
export const makeResult = (
  output: unknown,
  stopReason: "end_turn" | "tool_use" | "max_tokens",
  options?: {
    text?: string
    thinking?: string
    usage?: { inputTokens: number; outputTokens: number }
    sessionId?: string
  }
): AgentStreamEvent => ({
  _tag: "Result",
  output,
  stopReason,
  ...options
})
