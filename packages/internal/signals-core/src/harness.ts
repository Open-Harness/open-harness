/**
 * Harness Interface
 *
 * Harnesses are the bridge between Open Harness and AI SDKs.
 * They consume input, stream signals, and return structured output.
 */

import type { Signal } from "./signal.js";

// ============================================================================
// Run Context
// ============================================================================

/**
 * Minimal execution context passed to harness implementations.
 *
 * Intentionally minimal to avoid leaking runtime concerns into harnesses.
 */
export interface RunContext {
	/**
	 * Abort signal for cancellation.
	 * Harness should check `signal.aborted` periodically and
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
// Harness Input/Output
// ============================================================================

/**
 * Message in a conversation
 */
export interface Message {
	readonly role: "user" | "assistant" | "system";
	readonly content: string;
}

/**
 * Tool definition for the harness
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
 * Standard harness input
 *
 * This is the canonical input shape that all harnesses accept.
 * Harnesses may extend this with additional fields.
 */
export interface HarnessInput {
	/** System prompt */
	readonly system?: string;

	/** Conversation messages */
	readonly messages: readonly Message[];

	/** Available tools */
	readonly tools?: readonly ToolDefinition[];

	/** Tool results from previous turn */
	readonly toolResults?: readonly ToolResult[];

	/** Session ID for resume (harness-specific) */
	readonly sessionId?: string;

	/** Maximum tokens to generate */
	readonly maxTokens?: number;

	/** Temperature for generation (0-1) */
	readonly temperature?: number;
}

/**
 * Standard harness output
 *
 * This is the canonical output shape that all harnesses return.
 * Harnesses may extend this with additional fields.
 */
export interface HarnessOutput {
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
// Harness Interface
// ============================================================================

/**
 * Harness capabilities
 */
export interface HarnessCapabilities {
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
 * Harness - the core abstraction for AI SDK integration
 *
 * Harnesses:
 * - Accept standardized input
 * - Yield signals as events occur (streaming)
 * - Return standardized output
 *
 * The generator pattern allows harnesses to:
 * - Stream intermediate results (text deltas, thinking, tool calls)
 * - Be cancelled via AbortSignal
 * - Return final structured output
 *
 * @example
 * ```ts
 * const claudeHarness: Harness = {
 *   type: "claude",
 *   displayName: "Claude (Anthropic)",
 *   capabilities: { streaming: true, structuredOutput: true, tools: true, resume: true },
 *
 *   async *run(input, ctx) {
 *     const stream = await sdk.createSession(input);
 *     for await (const event of stream) {
 *       if (ctx.signal.aborted) break;
 *       yield createSignal("text:delta", { content: event.text }, { harness: "claude" });
 *     }
 *     return { content: stream.fullText, usage: stream.usage };
 *   }
 * };
 * ```
 */
export interface Harness<TInput extends HarnessInput = HarnessInput, TOutput extends HarnessOutput = HarnessOutput> {
	/** Unique harness type identifier (e.g., "claude", "openai") */
	readonly type: string;

	/** Human-readable display name */
	readonly displayName: string;

	/** Harness capabilities */
	readonly capabilities: HarnessCapabilities;

	/**
	 * Run the harness.
	 *
	 * This is an async generator that:
	 * - Yields Signal objects as events occur
	 * - Returns the final output
	 * - Should check ctx.signal.aborted and stop if true
	 *
	 * @param input - Harness input
	 * @param ctx - Run context with abort signal
	 * @returns Generator yielding signals, returning final output
	 */
	run(input: TInput, ctx: RunContext): AsyncGenerator<Signal, TOutput>;
}

// ============================================================================
// Harness Signal Contract
// ============================================================================

/**
 * Signals that harnesses MUST emit during execution.
 *
 * This contract ensures consistent signal emission across all harnesses,
 * enabling harness-agnostic recording and replay.
 *
 * Required signals:
 * - `harness:start` - Emitted when harness begins execution
 * - `harness:end` - Emitted when harness completes (success or error)
 *
 * Optional streaming signals:
 * - `text:delta` - Text content chunk
 * - `text:complete` - Final accumulated text
 * - `thinking:delta` - Reasoning content chunk (if supported)
 * - `tool:call` - Tool invocation
 * - `tool:result` - Tool result (when processing tool results)
 *
 * Error signals:
 * - `harness:error` - Non-fatal error (may continue)
 */
export const HARNESS_SIGNALS = {
	// Lifecycle
	START: "harness:start",
	END: "harness:end",
	ERROR: "harness:error",

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
 * Signal payloads for harness signals
 */
export interface HarnessSignalPayloads {
	"harness:start": { input: HarnessInput };
	"harness:end": { output: HarnessOutput; durationMs: number };
	"harness:error": { code: string; message: string; recoverable: boolean };
	"text:delta": { content: string };
	"text:complete": { content: string };
	"thinking:delta": { content: string };
	"thinking:complete": { content: string };
	"tool:call": { id: string; name: string; input: unknown };
	"tool:result": { id: string; name: string; result: unknown; error?: string };
}
