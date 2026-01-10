/**
 * Provider Interface
 *
 * Providers are the bridge between Open Harness and AI SDKs.
 * They consume input, stream signals, and return structured output.
 */

import type { Signal } from "./signal.js";

// ============================================================================
// Run Context
// ============================================================================

/**
 * Minimal execution context passed to provider implementations.
 *
 * Intentionally minimal to avoid leaking runtime concerns into providers.
 */
export interface RunContext {
	/**
	 * Abort signal for cancellation.
	 * Provider should check `signal.aborted` periodically and
	 * stop execution if true.
	 */
	readonly signal: AbortSignal;

	/**
	 * Unique run identifier for correlation.
	 * All signals from this run share this ID.
	 */
	readonly runId: string;
}

// ============================================================================
// Provider Input/Output
// ============================================================================

/**
 * Message in a conversation
 */
export interface Message {
	readonly role: "user" | "assistant" | "system";
	readonly content: string;
}

/**
 * Tool definition for the provider
 */
export interface ToolDefinition {
	readonly name: string;
	readonly description: string;
	readonly inputSchema: Record<string, unknown>;
}

/**
 * Tool result from execution
 */
export interface ToolResult {
	readonly toolName: string;
	readonly result: unknown;
	readonly error?: string;
}

/**
 * Standard provider input
 *
 * This is the canonical input shape that all providers accept.
 * Providers may extend this with additional fields.
 */
export interface ProviderInput {
	/** System prompt */
	readonly system?: string;

	/** Conversation messages */
	readonly messages: readonly Message[];

	/** Available tools */
	readonly tools?: readonly ToolDefinition[];

	/** Tool results from previous turn */
	readonly toolResults?: readonly ToolResult[];

	/** Session ID for resume (provider-specific) */
	readonly sessionId?: string;

	/** Maximum tokens to generate */
	readonly maxTokens?: number;

	/** Temperature for generation (0-1) */
	readonly temperature?: number;
}

/**
 * Standard provider output
 *
 * This is the canonical output shape that all providers return.
 * Providers may extend this with additional fields.
 */
export interface ProviderOutput {
	/** Text content generated */
	readonly content: string;

	/** Tool calls requested by the model */
	readonly toolCalls?: readonly ToolCall[];

	/** Session ID for resume */
	readonly sessionId?: string;

	/** Token usage */
	readonly usage?: TokenUsage;

	/** Whether the response was truncated */
	readonly stopReason?: "end" | "max_tokens" | "tool_use" | "error";
}

/**
 * Tool call from the model
 */
export interface ToolCall {
	readonly id: string;
	readonly name: string;
	readonly input: unknown;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly totalTokens: number;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
	/** Can stream events? */
	readonly streaming: boolean;
	/** Can return structured JSON? */
	readonly structuredOutput: boolean;
	/** Supports tool use? */
	readonly tools: boolean;
	/** Supports resume via session ID? */
	readonly resume: boolean;
}

/**
 * Provider - the core abstraction for AI SDK integration
 *
 * Providers:
 * - Accept standardized input
 * - Yield signals as events occur (streaming)
 * - Return standardized output
 *
 * The generator pattern allows providers to:
 * - Stream intermediate results (text deltas, thinking, tool calls)
 * - Be cancelled via AbortSignal
 * - Return final structured output
 *
 * @example
 * ```ts
 * const claudeProvider: Provider = {
 *   type: "claude",
 *   displayName: "Claude (Anthropic)",
 *   capabilities: { streaming: true, structuredOutput: true, tools: true, resume: true },
 *
 *   async *run(input, ctx) {
 *     const stream = await sdk.createSession(input);
 *     for await (const event of stream) {
 *       if (ctx.signal.aborted) break;
 *       yield createSignal("text:delta", { content: event.text }, { provider: "claude" });
 *     }
 *     return { content: stream.fullText, usage: stream.usage };
 *   }
 * };
 * ```
 */
export interface Provider<
	TInput extends ProviderInput = ProviderInput,
	TOutput extends ProviderOutput = ProviderOutput,
> {
	/** Unique provider type identifier (e.g., "claude", "openai") */
	readonly type: string;

	/** Human-readable display name */
	readonly displayName: string;

	/** Provider capabilities */
	readonly capabilities: ProviderCapabilities;

	/**
	 * Run the provider.
	 *
	 * This is an async generator that:
	 * - Yields Signal objects as events occur
	 * - Returns the final output
	 * - Should check ctx.signal.aborted and stop if true
	 *
	 * @param input - Provider input
	 * @param ctx - Run context with abort signal
	 * @returns Generator yielding signals, returning final output
	 */
	run(input: TInput, ctx: RunContext): AsyncGenerator<Signal, TOutput>;
}

// ============================================================================
// Provider Signal Contract
// ============================================================================

/**
 * Signals that providers MUST emit during execution.
 *
 * This contract ensures consistent signal emission across all providers,
 * enabling provider-agnostic recording and replay.
 *
 * Required signals:
 * - `provider:start` - Emitted when provider begins execution
 * - `provider:end` - Emitted when provider completes (success or error)
 *
 * Optional streaming signals:
 * - `text:delta` - Text content chunk
 * - `text:complete` - Final accumulated text
 * - `thinking:delta` - Reasoning content chunk (if supported)
 * - `tool:call` - Tool invocation
 * - `tool:result` - Tool result (when processing tool results)
 *
 * Error signals:
 * - `provider:error` - Non-fatal error (may continue)
 */
export const PROVIDER_SIGNALS = {
	// Lifecycle
	START: "provider:start",
	END: "provider:end",
	ERROR: "provider:error",

	// Text streaming
	TEXT_DELTA: "text:delta",
	TEXT_COMPLETE: "text:complete",

	// Thinking/reasoning (optional)
	THINKING_DELTA: "thinking:delta",
	THINKING_COMPLETE: "thinking:complete",

	// Tool use
	TOOL_CALL: "tool:call",
	TOOL_RESULT: "tool:result",
} as const;

/**
 * Signal payloads for provider signals
 */
export interface ProviderSignalPayloads {
	"provider:start": { input: ProviderInput };
	"provider:end": { output: ProviderOutput; durationMs: number };
	"provider:error": { code: string; message: string; recoverable: boolean };
	"text:delta": { content: string };
	"text:complete": { content: string };
	"thinking:delta": { content: string };
	"thinking:complete": { content: string };
	"tool:call": { id: string; name: string; input: unknown };
	"tool:result": { id: string; name: string; result: unknown; error?: string };
}
