/**
 * Provider Contracts - Public API Types
 *
 * These interfaces define the public API surface for LLM Providers.
 * Providers are abstracted via Effect Services internally.
 *
 * @module @core-v2/provider
 */

import type { AnyEvent } from "./event";

/**
 * Provider error with typed error codes.
 */
export interface ProviderError extends Error {
  /** Error code for programmatic handling */
  readonly code:
    | "RATE_LIMITED"
    | "CONTEXT_LENGTH_EXCEEDED"
    | "INVALID_REQUEST"
    | "NETWORK_ERROR"
    | "AUTHENTICATION_FAILED"
    | "PROVIDER_ERROR";
  /** Whether this error is retryable */
  readonly retryable: boolean;
  /** Retry delay hint (milliseconds) */
  readonly retryAfter?: number;
  /** Original cause if available */
  readonly cause?: unknown;
}

/**
 * Message format for provider requests.
 *
 * @remarks
 * Internal format used by providers. Not exposed publicly.
 */
export interface ProviderMessage {
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
}

/**
 * Options for provider query.
 *
 * @remarks
 * This is the internal interface used by the workflow runtime.
 * Maps directly to Claude Agent SDK options.
 * Not typically used directly by consumers.
 */
export interface QueryOptions {
  /** Messages to send */
  readonly messages: readonly ProviderMessage[];
  /** Session ID for resuming conversations (maps to SDK `resume` option) */
  readonly sessionId?: string;
  /** Model override */
  readonly model?: string;
  /** Abort controller for cancellation */
  readonly abortController?: AbortController;
  /** Maximum turns before stopping (SDK default: unlimited) */
  readonly maxTurns?: number;
  /** Whether to persist session state (default: true) */
  readonly persistSession?: boolean;
  /** Include partial messages in streaming (default: true) */
  readonly includePartialMessages?: boolean;
  /** Permission mode for tool execution */
  readonly permissionMode?: "bypassPermissions" | "askUser";
  /**
   * Structured output format - REQUIRED for workflow state reliability.
   * Maps to SDK `outputFormat: { type: "json_schema", schema }`.
   */
  readonly outputFormat?: {
    readonly type: "json_schema";
    readonly schema: unknown; // JSON Schema (converted from Zod at runtime)
  };
}

/**
 * Streaming chunk from provider.
 *
 * @remarks
 * Represents a single chunk from the LLM response stream.
 */
export interface StreamChunk {
  /** Chunk type */
  readonly type: "text" | "tool_use" | "stop";
  /** Text content (for text chunks) */
  readonly text?: string;
  /** Tool call info (for tool_use chunks) */
  readonly toolCall?: {
    readonly id: string;
    readonly name: string;
    readonly input: unknown;
  };
  /** Stop reason (for stop chunks) */
  readonly stopReason?: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
}

// ============================================================================
// Provider Configuration Types
// ============================================================================

/**
 * Claude provider configuration.
 *
 * @remarks
 * Uses Claude Code subscription authentication via `@anthropic-ai/claude-agent-sdk`.
 * No API key needed - authentication is automatic.
 *
 * These options map directly to the actual SDK options. Note that the Claude Agent SDK
 * does NOT support `temperature`, `maxTokens`, or `system` - those are API parameters,
 * not SDK parameters.
 *
 * @example
 * ```typescript
 * const config: ClaudeProviderConfig = {
 *   model: "claude-sonnet-4-20250514",
 *   maxTurns: 10,
 *   persistSession: true,
 * };
 * ```
 */
export interface ClaudeProviderConfig {
  /** Model to use (default: claude-sonnet-4-20250514) */
  readonly model?: string;
  /** Maximum turns before stopping (SDK default: unlimited) */
  readonly maxTurns?: number;
  /** Whether to persist session state (default: true) */
  readonly persistSession?: boolean;
  /** Include partial messages in streaming (default: true) */
  readonly includePartialMessages?: boolean;
  /** Permission mode for tool execution (default: bypassPermissions) */
  readonly permissionMode?: "bypassPermissions" | "askUser";
}

/**
 * Provider type identifier.
 */
export type ProviderType = "claude" | "custom";

/**
 * Provider metadata for display/debugging.
 */
export interface ProviderInfo {
  /** Provider type */
  readonly type: ProviderType;
  /** Provider name */
  readonly name: string;
  /** Current model */
  readonly model: string;
  /** Whether the provider is connected */
  readonly connected: boolean;
}
