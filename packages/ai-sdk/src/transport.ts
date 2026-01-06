import type { Runtime, RuntimeEvent } from "@open-harness/sdk";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { createPartTracker, transformEvent } from "./transforms.js";
import type { OpenHarnessChatTransportOptions } from "./types.js";

/**
 * ChatTransport implementation for Open Harness runtime.
 *
 * Transforms Open Harness runtime events into AI SDK UIMessageChunks,
 * enabling seamless integration with `useChat()` hook.
 */
export class OpenHarnessChatTransport implements ChatTransport<UIMessage> {
	private readonly runtime: Runtime;
	private readonly options: Required<OpenHarnessChatTransportOptions>;

	constructor(runtime: Runtime, options?: OpenHarnessChatTransportOptions) {
		this.runtime = runtime;
		this.options = {
			sendReasoning: options?.sendReasoning ?? true,
			sendStepMarkers: options?.sendStepMarkers ?? true,
			sendFlowMetadata: options?.sendFlowMetadata ?? false,
			sendNodeOutputs: options?.sendNodeOutputs ?? false,
			generateMessageId: options?.generateMessageId ?? (() => crypto.randomUUID()),
		};
	}

	async sendMessages(options: {
		trigger: "submit-message" | "regenerate-message";
		chatId: string;
		messageId: string | undefined;
		messages: UIMessage[];
		abortSignal?: AbortSignal;
	}): Promise<ReadableStream<UIMessageChunk>> {
		const { messages, abortSignal } = options;
		const messageId = this.options.generateMessageId();

		// Extract last user message
		const lastUserMessage = messages.findLast((m) => m.role === "user");
		if (!lastUserMessage) {
			throw new Error("No user message found");
		}

		// Extract text from message parts
		const textPart = lastUserMessage.parts.find((p) => p.type === "text") as { type: "text"; text: string } | undefined;
		if (!textPart) {
			throw new Error("User message has no text content");
		}

		return new ReadableStream<UIMessageChunk>({
			start: async (controller) => {
				const tracker = createPartTracker();
				let unsubscribe: (() => void) | null = null;
				let isClosed = false;

				// Subscribe to runtime events FIRST, before dispatching
				unsubscribe = this.runtime.onEvent((event: RuntimeEvent) => {
					// Early return if stream is already closed
					if (isClosed) {
						return;
					}

					try {
						const chunks = transformEvent(event, tracker, messageId, this.options);

						// Skip if no chunks or stream is closed
						if (!chunks || chunks.length === 0 || isClosed) {
							return;
						}

						for (const chunk of chunks) {
							// Check before each enqueue in case stream closed during processing
							if (isClosed) {
								return;
							}

							// Validate chunk before enqueuing
							if (!chunk || typeof chunk !== "object" || !("type" in chunk)) {
								console.warn("[Transport] Skipping invalid chunk:", chunk);
								continue;
							}

							try {
								controller.enqueue(chunk);
							} catch (enqueueError) {
								// Stream is closed - stop processing
								if (
									enqueueError instanceof TypeError &&
									(enqueueError.message.includes("closed") || enqueueError.message.includes("Cannot enqueue"))
								) {
									isClosed = true;
									// Unsubscribe immediately to stop further events
									if (unsubscribe) {
										unsubscribe();
										unsubscribe = null;
									}
									return;
								}
								// Re-throw unexpected errors
								throw enqueueError;
							}
						}

						// Close stream on terminal events
						if (event.type === "agent:complete" || event.type === "agent:paused" || event.type === "agent:aborted") {
							// Ensure text-end is sent if text was started
							if (tracker.textStarted && !tracker.textEnded) {
								try {
									if (!isClosed) {
										controller.enqueue({ type: "text-end", id: messageId });
										tracker.textEnded = true;
									}
								} catch (enqueueError) {
									// Stream might be closed, ignore
									if (enqueueError instanceof TypeError && enqueueError.message.includes("closed")) {
										isClosed = true;
									}
								}
							}

							isClosed = true;
							try {
								controller.close();
							} catch {
								// Stream might already be closed, ignore
							}
							if (unsubscribe) {
								unsubscribe();
							}
						}
					} catch (error) {
						// Only log if stream isn't already closed
						if (!isClosed) {
							console.error("Error transforming event:", error);
							isClosed = true;
							try {
								controller.enqueue({
									type: "error",
									errorText: error instanceof Error ? error.message : "Failed to transform event",
								});
								controller.close();
							} catch {
								// Stream might already be closed, ignore silently
							}
						}
						// Always unsubscribe on error
						if (unsubscribe) {
							unsubscribe();
							unsubscribe = null;
						}
					}
				});

				// Handle abort
				abortSignal?.addEventListener("abort", () => {
					if (!isClosed) {
						isClosed = true;
						controller.close();
						if (unsubscribe) {
							unsubscribe();
						}
					}
				});

				// Wait a tick to ensure subscription is fully set up
				await new Promise((resolve) => setTimeout(resolve, 0));

				// Dispatch message to runtime AFTER subscription is ready
				try {
					const runId = crypto.randomUUID();
					this.runtime.dispatch({
						type: "send",
						runId,
						message: textPart.text,
					});
				} catch (error) {
					console.error("Error dispatching message:", error);
					if (!isClosed) {
						isClosed = true;
						controller.enqueue({
							type: "error",
							errorText: error instanceof Error ? error.message : "Failed to dispatch message",
						});
						controller.close();
						if (unsubscribe) {
							unsubscribe();
						}
					}
				}
			},
		});
	}

	async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
		return null;
	}
}

/**
 * Create an OpenHarnessChatTransport instance.
 *
 * @param runtime - Open Harness runtime instance
 * @param options - Transport configuration
 * @returns ChatTransport instance compatible with useChat()
 */
export function createOpenHarnessChatTransport(
	runtime: Runtime,
	options?: OpenHarnessChatTransportOptions,
): OpenHarnessChatTransport {
	return new OpenHarnessChatTransport(runtime, options);
}
