/**
 * AgentProvider service - generic interface for agent SDKs.
 *
 * This is the internal Effect service that wraps SDK interactions.
 * Different implementations (Anthropic, Mock) provide this interface.
 *
 * @module
 */

import type { Effect, Stream } from "effect"
import { Context } from "effect"

import type { ProviderError } from "../Domain/Errors.js"

// ─────────────────────────────────────────────────────────────────
// Agent Run Options
// ─────────────────────────────────────────────────────────────────

/**
 * Options for running an agent (generic - all providers).
 */
export interface AgentRunOptions {
  /** User prompt (the actual request) */
  readonly prompt: string

  /** System prompt (instructions for the agent) */
  readonly systemPrompt?: string

  /** JSON Schema for structured output (converted from Zod at call site) */
  readonly outputSchema?: unknown

  /** Model override (provider interprets this) */
  readonly model?: string

  /** Session ID for multi-turn conversations (provider manages history) */
  readonly sessionId?: string

  /** Abort signal for cancellation */
  readonly abortSignal?: AbortSignal

  /**
   * SDK-specific options pass-through.
   * Each provider defines what it accepts here.
   * Generic code should NOT depend on these.
   */
  readonly providerOptions?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────
// Stream Events
// ─────────────────────────────────────────────────────────────────

/**
 * Events streamed during agent execution.
 * Providers emit what they support; consumers handle what they need.
 */
export type AgentStreamEvent =
  // Text streaming
  | { readonly _tag: "TextDelta"; readonly delta: string }
  | { readonly _tag: "TextComplete"; readonly text: string }
  // Thinking/reasoning (Claude extended thinking, o1-style, etc.)
  | { readonly _tag: "ThinkingDelta"; readonly delta: string }
  | { readonly _tag: "ThinkingComplete"; readonly thinking: string }
  // Tool use
  | { readonly _tag: "ToolCall"; readonly toolId: string; readonly toolName: string; readonly input: unknown }
  | { readonly _tag: "ToolResult"; readonly toolId: string; readonly output: unknown; readonly isError: boolean }
  // Lifecycle
  | { readonly _tag: "Stop"; readonly reason: "end_turn" | "tool_use" | "max_tokens" }
  // Usage
  | { readonly _tag: "Usage"; readonly inputTokens: number; readonly outputTokens: number }
  // Final structured output (needed to avoid a second provider call)
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
// Run Result
// ─────────────────────────────────────────────────────────────────

/**
 * Result from a completed agent run.
 */
export interface AgentRunResult {
  /** Full text response (if any) */
  readonly text?: string

  /** Full thinking/reasoning (if extended thinking was used) */
  readonly thinking?: string

  /** Parsed structured output (if outputSchema was provided) */
  readonly output?: unknown

  /** Session ID (for continuing multi-turn) */
  readonly sessionId?: string

  /** Token usage */
  readonly usage?: {
    readonly inputTokens: number
    readonly outputTokens: number
  }

  /** Why the agent stopped */
  readonly stopReason: "end_turn" | "tool_use" | "max_tokens"
}

// ─────────────────────────────────────────────────────────────────
// Provider Info
// ─────────────────────────────────────────────────────────────────

/**
 * Provider capabilities/info.
 */
export interface ProviderInfo {
  readonly type: "claude" | "codex" | "mock" | "custom"
  readonly name: string
  readonly defaultModel: string
  readonly connected: boolean
  /** What this provider supports */
  readonly capabilities?: {
    readonly streaming: boolean
    readonly structuredOutput: boolean
    readonly tools: boolean
    readonly extendedThinking: boolean
  }
}

// ─────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────

export interface AgentProviderService {
  /** Run agent and get complete result */
  readonly run: (
    options: AgentRunOptions
  ) => Effect.Effect<AgentRunResult, ProviderError>

  /** Run agent and stream events as they occur */
  readonly stream: (
    options: AgentRunOptions
  ) => Stream.Stream<AgentStreamEvent, ProviderError>

  /** Get provider info */
  readonly info: () => Effect.Effect<ProviderInfo, never>
}

// ─────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────

export class AgentProvider extends Context.Tag("@open-scaffold/AgentProvider")<
  AgentProvider,
  AgentProviderService
>() {}
