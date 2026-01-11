/**
 * CodexProvider - Provider implementation for OpenAI Codex SDK
 *
 * Bridges the @openai/codex-sdk to the Open Harness signal-based architecture.
 * Yields Signal objects as events stream in from the SDK.
 */

import {
	createSignal,
	PROVIDER_SIGNALS,
	type Provider,
	type ProviderCapabilities,
	type ProviderInput,
	type ProviderOutput,
	type RunContext,
	type Signal,
	type TokenUsage,
	type ToolCall,
} from "@internal/signals-core";
import type { Codex, Thread } from "@openai/codex-sdk";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Codex-specific provider input extensions
 */
export interface CodexProviderInput extends ProviderInput {
	/** Model to use (e.g., "gpt-5-nano", "gpt-5.2-codex", "o4-mini") */
	readonly model?: string;
	/** Working directory for Codex operations */
	readonly workingDirectory?: string;
	/** Skip git repo check */
	readonly skipGitRepoCheck?: boolean;
	/** JSON schema for structured output */
	readonly outputSchema?: Record<string, unknown>;
}

/**
 * Codex-specific provider output extensions
 */
export interface CodexProviderOutput extends ProviderOutput {
	/** Structured output if outputSchema was provided */
	readonly structuredOutput?: unknown;
	/** Thread ID for resume */
	readonly threadId?: string;
}

/**
 * Configuration for CodexProvider
 */
export interface CodexProviderConfig {
	/** Custom Codex instance (for testing) */
	codex?: Codex;
	/** Default model to use (e.g., "gpt-5-nano", "gpt-5.2-codex") */
	model?: string;
	/** Default working directory */
	workingDirectory?: string;
}

// ============================================================================
// Codex Event Types (from SDK)
// ============================================================================

/**
 * Codex SDK event structure
 * Based on @openai/codex-sdk event types
 */
interface CodexEvent {
	type: string;
	[key: string]: unknown;
}

/**
 * Item types from Codex events
 */
interface CodexItem {
	type: string;
	id?: string;
	text?: string;
	thinking?: string;
	name?: string;
	input?: unknown;
	result?: unknown;
	error?: string;
	[key: string]: unknown;
}

// ============================================================================
// CodexProvider Implementation
// ============================================================================

/**
 * Provider for OpenAI Codex SDK
 *
 * Implements the Provider interface for @openai/codex-sdk.
 * Emits signals as SDK events stream in.
 *
 * @example
 * ```ts
 * const provider = new CodexProvider();
 *
 * for await (const signal of provider.run(input, ctx)) {
 *   console.log(signal.name, signal.payload);
 * }
 * ```
 */
export class CodexProvider implements Provider<CodexProviderInput, CodexProviderOutput> {
	readonly type = "codex";
	readonly displayName = "Codex (OpenAI)";
	readonly capabilities: ProviderCapabilities = {
		streaming: true,
		structuredOutput: true,
		tools: true,
		resume: true,
	};

	private codex: Codex | null = null;
	private readonly defaultModel?: string;
	private readonly defaultWorkingDirectory?: string;

	constructor(config?: CodexProviderConfig) {
		// Store instance if provided, otherwise will use dynamic import
		if (config?.codex) {
			this.codex = config.codex;
		}
		this.defaultModel = config?.model;
		this.defaultWorkingDirectory = config?.workingDirectory;
	}

	/**
	 * Get or create Codex instance
	 */
	private async getCodex(): Promise<Codex> {
		if (this.codex) {
			return this.codex;
		}

		// Dynamic import to avoid issues if SDK not installed
		const { Codex } = await import("@openai/codex-sdk");
		this.codex = new Codex();
		return this.codex;
	}

	/**
	 * Run the provider
	 *
	 * Yields signals as the SDK streams events, then returns the final output.
	 */
	async *run(input: CodexProviderInput, ctx: RunContext): AsyncGenerator<Signal, CodexProviderOutput> {
		const startTime = Date.now();
		const source = { provider: this.type };

		// Track state for final output
		let accumulatedText = "";
		let accumulatedThinking = "";
		const toolCalls: ToolCall[] = [];
		let threadId: string | undefined = input.sessionId;
		let usage: TokenUsage | undefined;
		let structuredOutput: unknown;
		let stopReason: ProviderOutput["stopReason"] = "end";

		// Track pending tool uses for correlation
		const pendingToolUses = new Map<string, { name: string; input: unknown }>();

		// Emit provider:start
		yield createSignal(
			PROVIDER_SIGNALS.START,
			{
				input,
			},
			source,
		);

		try {
			const codex = await this.getCodex();

			// Get or resume thread
			let thread: Thread;
			const model = input.model ?? this.defaultModel;
			if (input.sessionId) {
				thread = codex.resumeThread(input.sessionId);
			} else {
				thread = codex.startThread({
					model,
					workingDirectory: input.workingDirectory ?? this.defaultWorkingDirectory,
					skipGitRepoCheck: input.skipGitRepoCheck,
				});
			}

			// Build prompt from messages
			const prompt = this.buildPrompt(input);

			// Run streamed
			const runOptions = input.outputSchema ? { outputSchema: input.outputSchema } : undefined;
			const { events } = await thread.runStreamed(prompt, runOptions);

			// Process events
			for await (const event of events) {
				// Check for abort
				if (ctx.signal.aborted) {
					break;
				}

				const codexEvent = event as CodexEvent;

				// Extract thread ID from thread.started
				if (codexEvent.type === "thread.started") {
					const eventThreadId = codexEvent.thread_id as string | undefined;
					if (eventThreadId) {
						threadId = eventThreadId;
					}
				}

				// Process event and yield signals
				yield* this.processEvent(
					codexEvent,
					source,
					pendingToolUses,
					(text) => {
						accumulatedText += text;
					},
					(thinking) => {
						accumulatedThinking += thinking;
					},
					(call) => {
						toolCalls.push(call);
					},
					(u) => {
						usage = u;
					},
					(so) => {
						structuredOutput = so;
					},
					(r) => {
						stopReason = r;
					},
				);
			}
		} catch (error) {
			// Check if abort was requested
			if (error instanceof Error && error.name === "AbortError" && ctx.signal.aborted) {
				const durationMs = Date.now() - startTime;
				yield createSignal(
					PROVIDER_SIGNALS.END,
					{
						output: {
							content: accumulatedText,
							toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
							sessionId: threadId,
							stopReason: "error",
						},
						durationMs,
					},
					source,
				);

				return {
					content: accumulatedText,
					toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
					sessionId: threadId,
					threadId,
					stopReason: "error",
				};
			}

			// Emit error signal
			yield createSignal(
				PROVIDER_SIGNALS.ERROR,
				{
					code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
					message: error instanceof Error ? error.message : String(error),
					recoverable: false,
				},
				source,
			);

			// Emit provider:end for error
			const durationMs = Date.now() - startTime;
			yield createSignal(
				PROVIDER_SIGNALS.END,
				{
					output: {
						content: accumulatedText,
						toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
						sessionId: threadId,
						stopReason: "error",
					},
					durationMs,
				},
				source,
			);

			throw error;
		}

		// Emit text:complete if we accumulated text
		if (accumulatedText) {
			yield createSignal(
				PROVIDER_SIGNALS.TEXT_COMPLETE,
				{
					content: accumulatedText,
				},
				source,
			);
		}

		// Emit thinking:complete if we accumulated thinking
		if (accumulatedThinking) {
			yield createSignal(
				PROVIDER_SIGNALS.THINKING_COMPLETE,
				{
					content: accumulatedThinking,
				},
				source,
			);
		}

		// Build final output
		const output: CodexProviderOutput = {
			content: accumulatedText,
			toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
			sessionId: threadId,
			threadId,
			usage,
			stopReason,
			structuredOutput,
		};

		// Emit provider:end
		const durationMs = Date.now() - startTime;
		yield createSignal(
			PROVIDER_SIGNALS.END,
			{
				output,
				durationMs,
			},
			source,
		);

		return output;
	}

	/**
	 * Process a Codex event and yield appropriate signals
	 */
	private *processEvent(
		event: CodexEvent,
		source: { provider: string },
		pendingToolUses: Map<string, { name: string; input: unknown }>,
		onText: (text: string) => void,
		onThinking: (thinking: string) => void,
		onToolCall: (call: ToolCall) => void,
		onUsage: (usage: TokenUsage) => void,
		onStructuredOutput: (output: unknown) => void,
		onStopReason: (r: ProviderOutput["stopReason"]) => void,
	): Generator<Signal> {
		const eventType = event.type;

		// Handle item.updated - streaming deltas
		if (eventType === "item.updated") {
			const item = event.item as CodexItem | undefined;
			if (!item) return;

			// Text delta from agent_message
			if (item.type === "agent_message" && typeof item.text === "string") {
				// This is a delta - the SDK sends incremental updates
				const text = item.text;
				if (text) {
					onText(text);
					yield createSignal(
						PROVIDER_SIGNALS.TEXT_DELTA,
						{
							content: text,
						},
						source,
					);
				}
			}

			// Thinking delta from reasoning
			if (item.type === "reasoning" && typeof item.thinking === "string") {
				const thinking = item.thinking;
				if (thinking) {
					onThinking(thinking);
					yield createSignal(
						PROVIDER_SIGNALS.THINKING_DELTA,
						{
							content: thinking,
						},
						source,
					);
				}
			}
		}

		// Handle item.started - tool calls beginning
		if (eventType === "item.started") {
			const item = event.item as CodexItem | undefined;
			if (!item) return;

			// MCP tool call started
			if (item.type === "mcp_tool_call") {
				const toolId = item.id ?? crypto.randomUUID();
				const toolName = item.name ?? "unknown";
				const toolInput = item.input;

				pendingToolUses.set(toolId, { name: toolName, input: toolInput });

				const toolCall: ToolCall = {
					id: toolId,
					name: toolName,
					input: toolInput,
				};
				onToolCall(toolCall);

				yield createSignal(
					PROVIDER_SIGNALS.TOOL_CALL,
					{
						id: toolId,
						name: toolName,
						input: toolInput,
					},
					source,
				);
			}

			// Command execution (shell) started
			if (item.type === "command_execution") {
				const toolId = item.id ?? crypto.randomUUID();
				const command = item.command as string | undefined;

				pendingToolUses.set(toolId, { name: "shell", input: { command } });

				const toolCall: ToolCall = {
					id: toolId,
					name: "shell",
					input: { command },
				};
				onToolCall(toolCall);

				yield createSignal(
					PROVIDER_SIGNALS.TOOL_CALL,
					{
						id: toolId,
						name: "shell",
						input: { command },
					},
					source,
				);
			}
		}

		// Handle item.completed - text, reasoning, or tool results
		if (eventType === "item.completed") {
			const item = event.item as CodexItem | undefined;
			if (!item) return;

			// Agent message completed - emit as text:delta (SDK sends complete, not streaming)
			if (item.type === "agent_message" && typeof item.text === "string") {
				const text = item.text;
				if (text) {
					onText(text);
					yield createSignal(
						PROVIDER_SIGNALS.TEXT_DELTA,
						{
							content: text,
						},
						source,
					);
				}
			}

			// Reasoning completed - emit as thinking:delta
			if (item.type === "reasoning" && typeof item.thinking === "string") {
				const thinking = item.thinking;
				if (thinking) {
					onThinking(thinking);
					yield createSignal(
						PROVIDER_SIGNALS.THINKING_DELTA,
						{
							content: thinking,
						},
						source,
					);
				}
			}

			// MCP tool call completed
			if (item.type === "mcp_tool_call") {
				const toolId = item.id ?? "unknown";
				const pending = pendingToolUses.get(toolId);
				const toolName = pending?.name ?? item.name ?? "unknown";
				const result = item.result;
				const error = item.error;

				if (toolId !== "unknown") {
					pendingToolUses.delete(toolId);
				}

				yield createSignal(
					PROVIDER_SIGNALS.TOOL_RESULT,
					{
						id: toolId,
						name: toolName,
						result,
						error,
					},
					source,
				);
			}

			// Command execution completed
			if (item.type === "command_execution") {
				const toolId = item.id ?? "unknown";
				const pending = pendingToolUses.get(toolId);
				const result = item.result ?? item.output;
				const error = item.error;

				if (toolId !== "unknown") {
					pendingToolUses.delete(toolId);
				}

				yield createSignal(
					PROVIDER_SIGNALS.TOOL_RESULT,
					{
						id: toolId,
						name: pending?.name ?? "shell",
						result,
						error,
					},
					source,
				);
			}
		}

		// Handle turn.completed - extract usage
		if (eventType === "turn.completed") {
			const turnUsage = event.usage as { input_tokens?: number; output_tokens?: number } | undefined;
			if (turnUsage) {
				onUsage({
					inputTokens: turnUsage.input_tokens ?? 0,
					outputTokens: turnUsage.output_tokens ?? 0,
					totalTokens: (turnUsage.input_tokens ?? 0) + (turnUsage.output_tokens ?? 0),
				});
			}

			// Check for structured output
			const finalResponse = event.finalResponse;
			if (finalResponse !== undefined && typeof finalResponse === "object") {
				onStructuredOutput(finalResponse);
			}

			onStopReason("end");
		}

		// Handle turn.failed - error
		if (eventType === "turn.failed") {
			onStopReason("error");

			const errorMessage = event.error as string | undefined;
			yield createSignal(
				PROVIDER_SIGNALS.ERROR,
				{
					code: "TURN_FAILED",
					message: errorMessage ?? "Turn failed",
					recoverable: false,
				},
				source,
			);
		}

		// Handle thread.error - fatal error
		if (eventType === "thread.error") {
			onStopReason("error");

			const errorMessage = event.error as string | undefined;
			yield createSignal(
				PROVIDER_SIGNALS.ERROR,
				{
					code: "THREAD_ERROR",
					message: errorMessage ?? "Thread error",
					recoverable: false,
				},
				source,
			);
		}
	}

	/**
	 * Build prompt from provider input
	 */
	private buildPrompt(input: CodexProviderInput): string {
		const parts: string[] = [];

		// Add system prompt if present
		if (input.system) {
			parts.push(input.system);
		}

		// Add messages
		for (const message of input.messages) {
			if (message.role === "user") {
				parts.push(message.content);
			}
		}

		return parts.join("\n\n");
	}
}
