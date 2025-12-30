import { type Options, query, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentDefinition, AgentExecuteContext } from "./agent.js";

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e?: unknown) => void };

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null;
}

function deferred<T>(): Deferred<T> {
	let resolve!: (v: T) => void;
	let reject!: (e?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

class PushableAsyncIterable<T> implements AsyncIterable<T>, AsyncIterator<T> {
	private items: T[] = [];
	private waiters: Array<(v: IteratorResult<T>) => void> = [];
	private closed = false;

	push(item: T): void {
		if (this.closed) return;
		const w = this.waiters.shift();
		if (w) w({ done: false, value: item });
		else this.items.push(item);
	}

	close(): void {
		if (this.closed) return;
		this.closed = true;
		for (const w of this.waiters) w({ done: true, value: undefined as never });
		this.waiters = [];
	}

	[Symbol.asyncIterator](): AsyncIterator<T> {
		return this;
	}

	async next(): Promise<IteratorResult<T>> {
		if (this.items.length > 0) return { done: false, value: this.items.shift() as T };
		if (this.closed) return { done: true, value: undefined as never };
		return await new Promise<IteratorResult<T>>((resolve) => this.waiters.push(resolve));
	}
}

function toSdkUserTextMessage(text: string, opts?: { isSynthetic?: boolean }): SDKUserMessage {
	// This matches how the SDK constructs a one-shot user message internally (see sdk.mjs).
	// NOTE: session_id is allowed to be "" at the beginning of a session.
	return {
		type: "user",
		session_id: "",
		parent_tool_use_id: null,
		isSynthetic: opts?.isSynthetic,
		message: {
			role: "user",
			content: [{ type: "text", text }],
		},
	} as unknown as SDKUserMessage;
}

export type AnthropicKernelInput =
	| string
	| {
			prompt: string;
			options?: Partial<Options>;
	  };

export interface AnthropicAgentConfig<TIn = AnthropicKernelInput> {
	name: string;
	/**
	 * Convert input -> prompt string.
	 * If omitted, `execute()` expects either a string input or `{ prompt: string }`.
	 */
	prompt?: (input: TIn) => string;
	/** Base SDK options (merged with per-execute overrides) */
	options?: Options;
	/**
	 * What to return from execute():
	 * - "text": return `result` string (default)
	 * - "structured": return `structured_output` (requires SDK outputFormat)
	 * - "both": return `{ text, structured }`
	 */
	resultMode?: "text" | "structured" | "both";
	/**
	 * When using streaming input, the SDK session can stay open waiting for more
	 * turns. After we observe the assistant finish a message (`message_stop`) and
	 * no tools are in-flight, we wait this long before ending the run (unless
	 * new inbox messages arrive).
	 */
	idleMsAfterMessageStop?: number;
}

export type AnthropicResultForMode<M extends "text" | "structured" | "both"> = M extends "text"
	? string
	: M extends "structured"
		? unknown
		: { text: string; structured: unknown };

/**
 * Minimal Anthropic (Claude Agent SDK) adapter for the spike kernel.
 *
 * - Starts a streaming `query()` run.
 * - Emits `agent:start`, `agent:text`, `agent:tool:*`, `agent:complete` with the harness-provided runId.
 * - Forwards `ctx.inbox` messages into the running session by streaming additional user turns.
 *
 * No DI, no recording/replay, no persistence.
 */
export class AnthropicAgentDefinition<TIn = AnthropicKernelInput, TMode extends "text" | "structured" | "both" = "text">
	implements AgentDefinition<TIn, AnthropicResultForMode<TMode>>
{
	readonly name: string;
	readonly emitsStartComplete = true;

	private readonly promptFn?: (input: TIn) => string;
	private readonly baseOptions?: Options;
	private readonly resultMode: TMode;
	private readonly idleMsAfterMessageStop: number;

	constructor(config: AnthropicAgentConfig<TIn>) {
		this.name = config.name;
		this.promptFn = config.prompt;
		this.baseOptions = config.options;
		this.resultMode = (config.resultMode ?? "text") as TMode;
		this.idleMsAfterMessageStop = config.idleMsAfterMessageStop ?? 250;
	}

	async execute(input: TIn, ctx: AgentExecuteContext): Promise<AnthropicResultForMode<TMode>> {
		const { hub, inbox, runId } = ctx;

		const resolvedPrompt = this.resolvePrompt(input);
		const options = this.resolveOptions(input);
		const abortController = options.abortController ?? new AbortController();

		// Force partial message events so we can emit streaming `agent:text` deltas.
		const sdkOptions: Options = {
			...options,
			abortController,
			includePartialMessages: options.includePartialMessages ?? true,
		};

		hub.emit({ type: "agent:start", agentName: this.name, runId });

		const userStream = new PushableAsyncIterable<SDKUserMessage>();
		userStream.push(toSdkUserTextMessage(resolvedPrompt));

		const toolNamesById = new Map<string, string>();
		const inflightToolUseIds = new Set<string>();
		let sawTextDelta = false;
		let sawThinkingDelta = false;
		let accumulatedText = "";
		let structuredFromTool: unknown;
		let messageStopSeen = false;
		let stopTimer: ReturnType<typeof setTimeout> | null = null;

		const clearStopTimer = () => {
			if (!stopTimer) return;
			clearTimeout(stopTimer);
			stopTimer = null;
		};

		const maybeScheduleStop = () => {
			if (stopRequested) return;
			if (!messageStopSeen) return;
			if (inflightToolUseIds.size > 0) return;
			if (stopTimer) return;
			stopTimer = setTimeout(() => {
				requestStop();
			}, this.idleMsAfterMessageStop);
		};

		const stopForwarding = deferred<void>();
		const inboxForwarder = (async () => {
			while (true) {
				const next = await Promise.race([
					inbox.pop().then((m) => ({ kind: "msg" as const, m })),
					stopForwarding.promise.then(() => ({ kind: "stop" as const })),
				]);
				if (next.kind === "stop") return;
				userStream.push(toSdkUserTextMessage(next.m.content, { isSynthetic: true }));
				// New user input => keep session alive
				clearStopTimer();
				messageStopSeen = false;
			}
		})();

		let finalResultText = "";
		let finalStructured: unknown;
		let stopRequested = false;
		let q: ReturnType<typeof query> | null = null;

		const requestStop = () => {
			if (stopRequested) return;
			stopRequested = true;
			// Stop inbox forwarding + signal end-of-input to the SDK.
			stopForwarding.resolve();
			userStream.close();
		};

		try {
			q = query({ prompt: userStream, options: sdkOptions });
			for await (const msg of q) {
				// Track tool in-flight IDs to avoid stopping mid-tool.
				if (msg.type === "assistant") {
					for (const block of msg.message.content) {
						if (block.type === "tool_use") inflightToolUseIds.add(block.id);
					}
				} else if (msg.type === "user") {
					const content = (msg.message as unknown as { content?: unknown }).content;
					if (Array.isArray(content)) {
						for (const block of content) {
							if (!isRecord(block) || block.type !== "tool_result") continue;
							const toolUseId =
								typeof block.toolUseId === "string"
									? block.toolUseId
									: typeof (block as Record<string, unknown>).tool_use_id === "string"
										? ((block as Record<string, unknown>).tool_use_id as string)
										: "";
							if (toolUseId) inflightToolUseIds.delete(toolUseId);
						}
					}
				} else if (msg.type === "stream_event" && msg.event.type === "message_stop") {
					messageStopSeen = true;
					maybeScheduleStop();
				}

				this.emitFromSdkMessage(msg, {
					hub,
					runId,
					toolNamesById,
					onText: (text) => {
						accumulatedText += text;
					},
					onStructuredFromTool: (structured) => {
						if (structured !== undefined) structuredFromTool = structured;
					},
					markSawTextDelta: () => {
						sawTextDelta = true;
					},
					markSawThinkingDelta: () => {
						sawThinkingDelta = true;
					},
					shouldEmitFullTextBlocks: () => !sawTextDelta,
					shouldEmitFullThinkingBlocks: () => !sawThinkingDelta,
					onResult: (resultText, structured) => {
						finalResultText = resultText;
						finalStructured = structured;
						// Default stop condition: finish this agent run after first result.
						requestStop();
					},
				});
				// If tools just finished and assistant had already stopped, we can now schedule stop.
				maybeScheduleStop();
				if (stopRequested) break;
			}

			hub.emit({ type: "agent:complete", agentName: this.name, success: true, runId });
			const resolvedText = finalResultText.length ? finalResultText : accumulatedText;
			const resolvedStructured = finalStructured ?? structuredFromTool;

			if (this.resultMode === "text") return resolvedText as AnthropicResultForMode<TMode>;
			if (this.resultMode === "structured") {
				if (resolvedStructured === undefined) {
					throw new Error(
						`AnthropicAgentDefinition("${this.name}") resultMode="structured" but no structured_output was returned (did you set options.outputFormat?).`,
					);
				}
				return resolvedStructured as AnthropicResultForMode<TMode>;
			}
			// both
			if (resolvedStructured === undefined) {
				throw new Error(
					`AnthropicAgentDefinition("${this.name}") resultMode="both" but no structured_output was returned (did you set options.outputFormat?).`,
				);
			}
			return { text: resolvedText, structured: resolvedStructured } as AnthropicResultForMode<TMode>;
		} catch (e) {
			hub.emit({ type: "agent:complete", agentName: this.name, success: false, runId });
			throw e;
		} finally {
			clearStopTimer();
			requestStop();
			// Ensure the underlying SDK session stops even if it’s waiting for more input.
			try {
				await q?.interrupt();
			} catch {
				// non-fatal
			}
			abortController.abort();
			try {
				await inboxForwarder;
			} catch {
				// non-fatal
			}
		}
	}

	private resolvePrompt(input: TIn): string {
		if (this.promptFn) return this.promptFn(input);
		if (typeof input === "string") return input;
		if (typeof (input as unknown as { prompt?: unknown }).prompt === "string") {
			return (input as unknown as { prompt: string }).prompt;
		}
		throw new Error(`AnthropicAgentDefinition("${this.name}") requires a prompt() fn or string/{prompt} input.`);
	}

	private resolveOptions(input: TIn): Options {
		const overrides = isRecord(input) ? input.options : undefined;
		if (!overrides) return this.baseOptions ?? {};
		return {
			...(this.baseOptions ?? {}),
			...(overrides as Partial<Options>),
		};
	}

	private emitFromSdkMessage(
		msg: SDKMessage,
		helpers: {
			hub: AgentExecuteContext["hub"];
			runId: string;
			toolNamesById: Map<string, string>;
			onText: (text: string) => void;
			onStructuredFromTool: (structured: unknown | undefined) => void;
			markSawTextDelta: () => void;
			markSawThinkingDelta: () => void;
			shouldEmitFullTextBlocks: () => boolean;
			shouldEmitFullThinkingBlocks: () => boolean;
			onResult: (resultText: string, structured: unknown | undefined) => void;
		},
	): void {
		const { hub, runId, toolNamesById } = helpers;

		// Partial/streaming message events
		if (msg.type === "stream_event") {
			if (msg.event.type === "content_block_delta") {
				const delta = (msg.event as unknown as { delta?: unknown }).delta;
				if (isRecord(delta) && delta.type === "text_delta" && typeof delta.text === "string") {
					helpers.onText(delta.text);
					helpers.markSawTextDelta();
					hub.emit({ type: "agent:text", content: delta.text, runId });
				} else if (isRecord(delta) && delta.type === "thinking_delta" && typeof delta.thinking === "string") {
					helpers.markSawThinkingDelta();
					hub.emit({ type: "agent:thinking", content: delta.thinking, runId });
				}
			}
			return;
		}

		// Full assistant messages (tool_use lives here)
		if (msg.type === "assistant") {
			for (const block of msg.message.content) {
				if (block.type === "text" && helpers.shouldEmitFullTextBlocks()) {
					helpers.onText(block.text);
					hub.emit({ type: "agent:text", content: block.text, runId });
				} else if (block.type === "thinking" && helpers.shouldEmitFullThinkingBlocks()) {
					hub.emit({ type: "agent:thinking", content: block.thinking, runId });
				} else if (block.type === "tool_use") {
					toolNamesById.set(block.id, block.name);
					hub.emit({ type: "agent:tool:start", toolName: block.name, input: block.input, runId });
				}
			}
			return;
		}

		// Tool results arrive as user messages containing tool_result blocks
		if (msg.type === "user") {
			const content = (msg.message as unknown as { content?: unknown }).content;
			if (Array.isArray(content)) {
				for (const block of content) {
					if (!isRecord(block) || block.type !== "tool_result") continue;
					const toolUseId =
						typeof block.toolUseId === "string"
							? block.toolUseId
							: typeof (block as Record<string, unknown>).tool_use_id === "string"
								? ((block as Record<string, unknown>).tool_use_id as string)
								: "";
					const toolName = toolNamesById.get(toolUseId) ?? "unknown";
					const result = "structuredContent" in block ? block.structuredContent : block.content;
					const isError = Boolean(
						("isError" in block
							? (block as Record<string, unknown>).isError
							: (block as Record<string, unknown>).is_error) ?? false,
					);
					hub.emit({ type: "agent:tool:complete", toolName, result, isError, runId });

					// Structured output is often returned via the internal StructuredOutput tool
					// rather than the final `result` message in streaming-input mode.
					if (toolName === "StructuredOutput" && !isError) {
						const structured =
							"structuredContent" in block
								? (block as Record<string, unknown>).structuredContent
								: "structured_content" in block
									? (block as Record<string, unknown>).structured_content
									: undefined;
						helpers.onStructuredFromTool(structured);
					}
				}
			}
			return;
		}

		// Final result message
		if (msg.type === "result") {
			if (msg.subtype === "success") {
				const resultText = String(msg.result ?? "");
				helpers.onResult(resultText, msg.structured_output);
				return;
			}
			const errors =
				"errors" in msg && Array.isArray(msg.errors)
					? msg.errors.join("\n")
					: `Anthropic execution failed: ${msg.subtype}`;
			throw new Error(errors);
		}
	}
}
