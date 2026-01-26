/**
 * Claude Provider Implementation
 *
 * This module implements the LLMProviderService interface using the
 * @anthropic-ai/claude-agent-sdk. It converts SDK messages to Effect Streams
 * and maps them to internal Event types.
 *
 * @module @core-v2/provider
 */

import type { Options, SDKMessage, SDKResultMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { Effect, Layer, Stream } from "effect";
import { type AnyEvent, createEvent, type EventId } from "../event/Event.js";
import { convertZodToJsonSchema } from "../internal/schema.js";
import {
	type ClaudeProviderConfig,
	LLMProvider,
	type LLMProviderService,
	ProviderError,
	type ProviderInfo,
	type QueryOptions,
	type QueryResult,
	type StreamChunk,
} from "./Provider.js";

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

// ============================================================================
// SDK Message Mapping
// ============================================================================

/**
 * Extracts session ID from an SDK message.
 */
function extractSessionId(message: SDKMessage): string | undefined {
	if (message && typeof message === "object" && "session_id" in message) {
		const sessionId = (message as { session_id?: string }).session_id;
		return sessionId || undefined;
	}
	return undefined;
}

/**
 * Maps SDK messages to StreamChunks for the Effect Stream.
 */
function* mapToStreamChunks(
	sdkMessage: SDKMessage,
	pendingToolUses: Map<string, { toolName: string; toolInput: unknown }>,
): Generator<StreamChunk> {
	// Handle stream events (text_delta)
	if (sdkMessage.type === "stream_event") {
		const streamEvent = sdkMessage.event as {
			type?: string;
			delta?: { type?: string; text?: string };
		};
		if (streamEvent?.type === "content_block_delta") {
			const delta = streamEvent.delta;
			if (delta?.type === "text_delta" && delta.text) {
				yield {
					type: "text",
					text: delta.text,
				};
			}
		}
	}

	// Handle assistant messages
	if (sdkMessage.type === "assistant") {
		const content = sdkMessage.message?.content;

		// Handle string content
		if (typeof content === "string") {
			yield {
				type: "text",
				text: content,
			};
		}

		// Handle array content (blocks)
		if (Array.isArray(content)) {
			for (const block of content as unknown as Array<Record<string, unknown>>) {
				const blockType = block.type;

				// Handle tool_use blocks
				if (blockType === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
					pendingToolUses.set(block.id, {
						toolName: block.name,
						toolInput: block.input,
					});
					yield {
						type: "tool_use",
						toolCall: {
							id: block.id,
							name: block.name,
							input: block.input,
						},
					};
				}

				// Handle text blocks
				if (blockType === "text") {
					const text = block.text;
					if (typeof text === "string" && text.length > 0) {
						yield {
							type: "text",
							text,
						};
					}
				}
			}
		}
	}

	// Handle result messages
	if (sdkMessage.type === "result") {
		const result = sdkMessage as SDKResultMessage;
		yield {
			type: "stop",
			stopReason: result.subtype === "success" ? "end_turn" : undefined,
		};
	}
}

/**
 * Maps SDK messages to internal Event types.
 */
function* mapToEvents(
	sdkMessage: SDKMessage,
	pendingToolUses: Map<string, { toolName: string; toolInput: unknown }>,
	agentName: string,
	causedBy?: EventId,
): Generator<AnyEvent> {
	// Handle stream events (text_delta)
	if (sdkMessage.type === "stream_event") {
		const streamEvent = sdkMessage.event as {
			type?: string;
			delta?: { type?: string; text?: string };
		};
		if (streamEvent?.type === "content_block_delta") {
			const delta = streamEvent.delta;
			if (delta?.type === "text_delta" && delta.text) {
				yield createEvent("text:delta", { delta: delta.text, agentName }, causedBy);
			}
		}
	}

	// Handle assistant messages
	if (sdkMessage.type === "assistant") {
		const content = sdkMessage.message?.content;

		// Handle array content (blocks)
		if (Array.isArray(content)) {
			for (const block of content as unknown as Array<Record<string, unknown>>) {
				const blockType = block.type;

				// Handle tool_use blocks
				if (blockType === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
					pendingToolUses.set(block.id, {
						toolName: block.name,
						toolInput: block.input,
					});
					yield createEvent(
						"tool:called",
						{
							toolName: block.name,
							toolId: block.id,
							input: block.input,
						},
						causedBy,
					);
				}
			}
		}
	}

	// Handle tool use results
	if (sdkMessage.type === "user" && sdkMessage.tool_use_result) {
		const toolUseId = sdkMessage.parent_tool_use_id ?? undefined;

		const isError = !!(
			typeof sdkMessage.tool_use_result === "object" &&
			sdkMessage.tool_use_result &&
			"error" in sdkMessage.tool_use_result
		);

		if (toolUseId) {
			pendingToolUses.delete(toolUseId);
			yield createEvent(
				"tool:result",
				{
					toolId: toolUseId,
					output: sdkMessage.tool_use_result,
					isError,
				},
				causedBy,
			);
		}
	}
}

// ============================================================================
// Claude Provider Service Implementation
// ============================================================================

/**
 * Converts an error to a ProviderError.
 * Used in both query and stream methods for consistent error handling.
 */
function toProviderError(error: unknown): ProviderError {
	if (error instanceof ProviderError) {
		return error;
	}

	if (error instanceof Error && error.name === "AbortError") {
		return new ProviderError("PROVIDER_ERROR", "Request was aborted", false, undefined, error);
	}

	return new ProviderError(
		"PROVIDER_ERROR",
		error instanceof Error ? error.message : String(error),
		true,
		undefined,
		error,
	);
}

/**
 * Creates the Claude provider service implementation.
 *
 * This service uses Effect.acquireRelease to ensure proper resource cleanup (FR-064).
 * When the Effect fiber is interrupted (e.g., workflow aborted), the SDK's AbortController
 * is automatically triggered to cancel any in-flight requests.
 *
 * @param config - Optional configuration for the provider
 * @param queryFn - Optional query function (for testing)
 * @returns LLMProviderService implementation
 */
export function makeClaudeProviderService(
	config: ClaudeProviderConfig = {},
	queryFn: typeof query = query,
): LLMProviderService {
	const model = config.model ?? DEFAULT_MODEL;

	const service: LLMProviderService = {
		query: (options: QueryOptions) =>
			// FR-064: Use Effect.acquireRelease for resource safety
			// This ensures the AbortController is triggered on fiber interruption
			Effect.acquireUseRelease(
				// Acquire: Create or use provided AbortController
				Effect.sync(() => options.abortController ?? new AbortController()),
				// Use: Execute the SDK query with the controller
				(controller) =>
					Effect.tryPromise({
						try: async () => {
							const sdkMessages = toClaudeMessages(options.messages);
							const sdkOptions = buildSdkOptions(config, { ...options, abortController: controller });

							const events: AnyEvent[] = [];
							const pendingToolUses = new Map<string, { toolName: string; toolInput: unknown }>();
							let sessionId = options.sessionId;
							let text = "";
							let structuredOutput: unknown;
							let stopReason: QueryResult["stopReason"];

							const queryStream = queryFn({ prompt: sdkMessages, options: sdkOptions });

							for await (const message of queryStream) {
								const sdkMessage = message as SDKMessage;

								// Extract session ID
								const msgSessionId = extractSessionId(sdkMessage);
								if (msgSessionId) {
									sessionId = msgSessionId;
								}

								// Map to events
								for (const event of mapToEvents(sdkMessage, pendingToolUses, "claude")) {
									events.push(event);
								}

								// Accumulate text from stream events
								if (sdkMessage.type === "stream_event") {
									const streamEvent = sdkMessage.event as {
										type?: string;
										delta?: { type?: string; text?: string };
									};
									if (streamEvent?.type === "content_block_delta") {
										const delta = streamEvent.delta;
										if (delta?.type === "text_delta" && delta.text) {
											text += delta.text;
										}
									}
								}

								// Handle result
								if (sdkMessage.type === "result") {
									const result = sdkMessage as SDKResultMessage;
									sessionId = result.session_id ?? sessionId;
									stopReason = result.subtype === "success" ? "end_turn" : undefined;

									if (result.subtype !== "success") {
										const errors = "errors" in result ? (result.errors as string[]) : [];
										throw new ProviderError(
											"PROVIDER_ERROR",
											errors.length > 0 ? errors.join("; ") : `Claude agent failed: ${result.subtype}`,
											false,
											undefined,
										);
									}

									// Now we know subtype is "success", so structured_output exists
									structuredOutput = result.structured_output;

									// Final text from result
									if (typeof result.result === "string") {
										text = result.result;
									}
								}
							}

							// Add text:complete event if we accumulated text
							if (text.length > 0) {
								events.push(createEvent("text:complete", { fullText: text, agentName: "claude" }));
							}

							return {
								events,
								text: text || undefined,
								output: structuredOutput,
								sessionId,
								stopReason,
							} satisfies QueryResult;
						},
						catch: toProviderError,
					}),
				// Release: Abort the controller on interruption/failure (FR-064 resource safety)
				(controller, exit) =>
					Effect.sync(() => {
						// Only abort if we created our own controller (not user-provided)
						// AND the exit was not a success (failure or interruption)
						if (!options.abortController && !exit._tag.startsWith("Success")) {
							controller.abort();
						}
					}),
			),

		stream: (options: QueryOptions) => {
			// FR-064: Use Stream.acquireRelease for resource safety in streaming
			// This ensures the AbortController is triggered when the stream is interrupted
			return Stream.acquireRelease(
				// Acquire: Create or use provided AbortController
				Effect.sync(() => options.abortController ?? new AbortController()),
				// Release: Abort the controller on interruption (FR-064 resource safety)
				(controller) =>
					Effect.sync(() => {
						// Only abort if we created our own controller (not user-provided)
						if (!options.abortController) {
							controller.abort();
						}
					}),
			).pipe(
				Stream.flatMap((controller) => {
					const sdkMessages = toClaudeMessages(options.messages);
					const sdkOptions = buildSdkOptions(config, { ...options, abortController: controller });
					const pendingToolUses = new Map<string, { toolName: string; toolInput: unknown }>();

					// Create async iterable from SDK query
					const asyncIterable: AsyncIterable<StreamChunk> = {
						async *[Symbol.asyncIterator]() {
							try {
								const queryStream = queryFn({ prompt: sdkMessages, options: sdkOptions });

								for await (const message of queryStream) {
									const sdkMessage = message as SDKMessage;
									yield* mapToStreamChunks(sdkMessage, pendingToolUses);
								}
							} catch (error) {
								throw toProviderError(error);
							}
						},
					};

					// Convert async iterable to Effect Stream
					return Stream.fromAsyncIterable(asyncIterable, toProviderError);
				}),
			);
		},

		info: () =>
			Effect.succeed({
				type: "claude",
				name: "Claude Agent SDK",
				model,
				connected: true,
			} satisfies ProviderInfo),
	};

	return service;
}

/**
 * Converts ProviderMessages to Claude SDK user messages.
 * Returns an AsyncGenerator to match the SDK's expected AsyncIterable<SDKUserMessage> type.
 */
async function* toClaudeMessages(
	messages: readonly { role: string; content: string }[],
): AsyncGenerator<SDKUserMessage> {
	for (const message of messages) {
		yield {
			type: "user",
			message: {
				role: message.role as "user" | "assistant",
				content: message.content,
			} as SDKUserMessage["message"],
			parent_tool_use_id: null,
			isSynthetic: false,
			tool_use_result: undefined,
			session_id: "",
		} as SDKUserMessage;
	}
}

/**
 * Resolves the output format from query options.
 *
 * Per FR-067, this function handles Zod schema conversion:
 * 1. If `outputFormat` is provided, use it directly (already JSON Schema)
 * 2. If `zodSchema` is provided, convert it to JSON Schema format
 * 3. Otherwise, no output format is used
 *
 * @param options - Query options that may contain outputFormat or zodSchema
 * @returns The resolved output format or undefined
 */
function resolveOutputFormat(
	options: QueryOptions,
): { type: "json_schema"; schema: Record<string, unknown> } | undefined {
	// outputFormat takes precedence (already JSON Schema)
	if (options.outputFormat) {
		return {
			type: "json_schema",
			schema: options.outputFormat.schema as Record<string, unknown>,
		};
	}

	// Convert zodSchema to JSON Schema if provided (FR-067)
	if (options.zodSchema) {
		const jsonSchema = convertZodToJsonSchema(options.zodSchema as Parameters<typeof convertZodToJsonSchema>[0]);
		return {
			type: "json_schema",
			schema: jsonSchema as Record<string, unknown>,
		};
	}

	return undefined;
}

/**
 * Builds SDK options from config and query options.
 */
function buildSdkOptions(config: ClaudeProviderConfig, options: QueryOptions): Options {
	const outputFormat = resolveOutputFormat(options);

	return {
		resume: options.sessionId,
		model: options.model ?? config.model ?? DEFAULT_MODEL,
		abortController: options.abortController,
		maxTurns: options.maxTurns ?? config.maxTurns ?? 100,
		persistSession: options.persistSession ?? config.persistSession ?? true,
		includePartialMessages: options.includePartialMessages ?? config.includePartialMessages ?? true,
		permissionMode: options.permissionMode ?? config.permissionMode ?? "bypassPermissions",
		allowDangerouslySkipPermissions: true,
		...(outputFormat ? { outputFormat } : {}),
	};
}

// ============================================================================
// Layer Implementation
// ============================================================================

/**
 * Creates a ClaudeProviderLive Layer with the given configuration.
 *
 * @param config - Optional configuration for the provider
 * @returns Effect Layer that provides LLMProvider
 *
 * @example
 * ```typescript
 * // Default configuration
 * const program = Effect.gen(function* () {
 *   const provider = yield* LLMProvider;
 *   return yield* provider.query({ messages: [...] });
 * });
 *
 * const runnable = program.pipe(Effect.provide(ClaudeProviderLive()));
 * ```
 */
export function makeClaudeProviderLive(config: ClaudeProviderConfig = {}): Layer.Layer<LLMProvider> {
	return Layer.succeed(LLMProvider, makeClaudeProviderService(config));
}

/**
 * Default ClaudeProviderLive Layer with default configuration.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const provider = yield* LLMProvider;
 *   return yield* provider.query({ messages: [...] });
 * });
 *
 * const runnable = program.pipe(Effect.provide(ClaudeProviderLive));
 * ```
 */
export const ClaudeProviderLive: Layer.Layer<LLMProvider> = makeClaudeProviderLive();

// ============================================================================
// Public API Factory (Promise-based)
// ============================================================================

/**
 * Creates a Promise-based Claude provider instance.
 *
 * This is the consumer-facing factory that returns a provider with
 * Promise-based methods, hiding all Effect types.
 *
 * @param config - Optional configuration for the provider
 * @returns Promise that resolves to a PublicLLMProvider
 *
 * @example
 * ```typescript
 * const provider = await createClaudeProvider({ model: "claude-sonnet-4-20250514" });
 *
 * // Query (non-streaming)
 * const result = await provider.query({
 *   messages: [{ role: "user", content: "Hello!" }],
 * });
 *
 * // Stream
 * for await (const chunk of provider.stream({ messages })) {
 *   if (chunk.type === "text") {
 *     process.stdout.write(chunk.text ?? "");
 *   }
 * }
 * ```
 */
export async function createClaudeProvider(config: ClaudeProviderConfig = {}): Promise<{
	query(options: QueryOptions): Promise<QueryResult>;
	stream(options: QueryOptions): AsyncIterable<StreamChunk>;
	info(): Promise<ProviderInfo>;
}> {
	const service = makeClaudeProviderService(config);

	return {
		query: (options: QueryOptions) => Effect.runPromise(service.query(options)),
		stream: (options: QueryOptions) => ({
			async *[Symbol.asyncIterator]() {
				const readableStream = Stream.toReadableStream(service.stream(options));
				const reader = readableStream.getReader();
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						yield value;
					}
				} finally {
					reader.releaseLock();
				}
			},
		}),
		info: () => Effect.runPromise(service.info()),
	};
}
