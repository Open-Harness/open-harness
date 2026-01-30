/**
 * Provider types - AI provider abstractions for Agent SDKs.
 *
 * Each provider wraps an SDK (Anthropic, Codex, etc.) and exposes
 * a streaming interface for agent execution.
 *
 * @module
 */

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
