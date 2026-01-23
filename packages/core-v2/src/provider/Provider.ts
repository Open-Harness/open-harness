/**
 * LLM Provider Service Definition
 *
 * The LLMProvider is responsible for querying LLM services and streaming responses.
 * This module defines the LLMProvider service tag and interface for the
 * Effect Layer pattern.
 *
 * @module @core-v2/provider
 */

import { Context, type Effect, type Stream } from "effect";
import type { AnyEvent } from "../event/Event.js";

// ============================================================================
// Provider Error
// ============================================================================

/**
 * Provider error codes for programmatic handling.
 */
export type ProviderErrorCode =
	| "RATE_LIMITED"
	| "CONTEXT_LENGTH_EXCEEDED"
	| "INVALID_REQUEST"
	| "NETWORK_ERROR"
	| "AUTHENTICATION_FAILED"
	| "PROVIDER_ERROR";

/**
 * Provider error class with typed error codes.
 * Used as Effect error channel type.
 */
export class ProviderError extends Error {
	readonly _tag = "ProviderError";

	constructor(
		/** Error code for programmatic handling */
		readonly code: ProviderErrorCode,
		/** Human-readable error message */
		message: string,
		/** Whether this error is retryable */
		readonly retryable: boolean,
		/** Retry delay hint (milliseconds) */
		readonly retryAfter?: number,
		/** Original cause if available */
		override readonly cause?: unknown,
	) {
		super(message, { cause });
		this.name = "ProviderError";
	}
}

// ============================================================================
// Provider Message Types
// ============================================================================

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
	 *
	 * @remarks
	 * You can provide either:
	 * 1. A pre-converted JSON Schema via `outputFormat`
	 * 2. A Zod schema via `zodSchema` which will be auto-converted (FR-067)
	 *
	 * If both are provided, `outputFormat` takes precedence.
	 */
	readonly outputFormat?: {
		readonly type: "json_schema";
		readonly schema: unknown; // JSON Schema (converted from Zod at runtime)
	};
	/**
	 * Zod schema for structured output (auto-converted to JSON Schema per FR-067).
	 *
	 * @remarks
	 * Convenience option that automatically converts the Zod schema to JSON Schema
	 * format for the SDK. If `outputFormat` is also provided, it takes precedence.
	 *
	 * @example
	 * ```typescript
	 * import { z } from "zod";
	 *
	 * const schema = z.object({
	 *   name: z.string(),
	 *   age: z.number(),
	 * });
	 *
	 * const result = await provider.query({
	 *   messages: [{ role: "user", content: "Extract user info" }],
	 *   zodSchema: schema,
	 * });
	 * ```
	 */
	readonly zodSchema?: unknown; // Zod schema (converted via convertZodToJsonSchema)
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

/**
 * Query result returned from non-streaming query.
 */
export interface QueryResult {
	/** Generated events from the query */
	readonly events: readonly AnyEvent[];
	/** Final text output (if any) */
	readonly text?: string;
	/** Structured output parsed from JSON response (if outputFormat was provided) */
	readonly output?: unknown;
	/** Session ID if session was created/resumed */
	readonly sessionId?: string;
	/** Stop reason */
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

// ============================================================================
// LLM Provider Service Interface (Effect Internal)
// ============================================================================

/**
 * LLM Provider service interface - defines operations for LLM interaction.
 *
 * @remarks
 * This is the internal Effect service interface. All methods return
 * Effect types. The public API wraps these with Promise-based methods.
 *
 * Operations:
 * - `query`: Send messages and get complete response
 * - `stream`: Send messages and get streaming response
 * - `info`: Get provider metadata
 */
export interface LLMProviderService {
	/**
	 * Send messages and get a complete response.
	 *
	 * @remarks
	 * Use this for simple request-response interactions where
	 * streaming is not needed.
	 *
	 * @param options - Query options including messages
	 * @returns Effect that succeeds with QueryResult or fails with ProviderError
	 */
	readonly query: (options: QueryOptions) => Effect.Effect<QueryResult, ProviderError>;

	/**
	 * Send messages and get a streaming response.
	 *
	 * @remarks
	 * Returns a Stream of StreamChunk values. Each chunk represents
	 * a piece of the response (text delta, tool use, or stop signal).
	 *
	 * @param options - Query options including messages
	 * @returns Stream of response chunks, can fail with ProviderError
	 */
	readonly stream: (options: QueryOptions) => Stream.Stream<StreamChunk, ProviderError>;

	/**
	 * Get provider metadata.
	 *
	 * @returns Effect with provider info
	 */
	readonly info: () => Effect.Effect<ProviderInfo, ProviderError>;
}

// ============================================================================
// LLM Provider Context Tag
// ============================================================================

/**
 * LLMProvider service tag for Effect dependency injection.
 *
 * @example
 * ```typescript
 * // Using the provider in an Effect program
 * const program = Effect.gen(function* () {
 *   const provider = yield* LLMProvider;
 *   const result = yield* provider.query({
 *     messages: [{ role: "user", content: "Hello" }],
 *   });
 *   return result;
 * });
 *
 * // Providing the provider layer
 * const runnable = program.pipe(Effect.provide(ClaudeProviderLive));
 * ```
 */
export class LLMProvider extends Context.Tag("@core-v2/LLMProvider")<LLMProvider, LLMProviderService>() {}

// ============================================================================
// Consumer-Facing Provider Interface (Promise-based)
// ============================================================================

/**
 * Consumer-facing LLMProvider interface with Promise-based methods.
 * This is what the public API exposes - no Effect types.
 */
export interface PublicLLMProvider {
	/**
	 * Send messages and get a complete response.
	 *
	 * @param options - Query options including messages
	 * @returns Promise with query result
	 * @throws ProviderError if query fails
	 */
	query(options: QueryOptions): Promise<QueryResult>;

	/**
	 * Send messages and get a streaming response.
	 *
	 * @remarks
	 * Returns an AsyncIterable of chunks. Use for-await-of to consume.
	 *
	 * @param options - Query options including messages
	 * @returns AsyncIterable of response chunks
	 * @throws ProviderError if stream fails
	 *
	 * @example
	 * ```typescript
	 * const stream = provider.stream({ messages });
	 * for await (const chunk of stream) {
	 *   if (chunk.type === "text") {
	 *     process.stdout.write(chunk.text ?? "");
	 *   }
	 * }
	 * ```
	 */
	stream(options: QueryOptions): AsyncIterable<StreamChunk>;

	/**
	 * Get provider metadata.
	 *
	 * @returns Provider info
	 */
	info(): Promise<ProviderInfo>;
}
