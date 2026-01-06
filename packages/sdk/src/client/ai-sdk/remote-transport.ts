import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

export interface RemoteAIKitTransportOptions {
  serverUrl: string;
  /**
   * Total request timeout for the SSE stream.
   * @default 30 minutes
   */
  timeout?: number;
}

export class RemoteAIKitTransport implements ChatTransport<UIMessage> {
  private readonly serverUrl: string;
  private readonly timeoutMs: number;

  constructor(options: RemoteAIKitTransportOptions) {
    this.serverUrl = options.serverUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeout ?? 30 * 60 * 1000;
  }

  async sendMessages(options: {
    trigger: "submit-message" | "regenerate-message";
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<UIMessageChunk>> {
    const { messages, abortSignal } = options;

    const res = await fetch(`${this.serverUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: abortSignal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Chat request failed (${res.status} ${res.statusText})${text ? `: ${text}` : ""}`,
      );
    }

    const { runId } = (await res.json()) as { runId?: string };
    if (!runId) {
      throw new Error("Chat response missing runId");
    }

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        // Note: this package does not include DOM libs in tsconfig.
        // Treat EventSource as an optional runtime-global.
        const ES = (globalThis as any).EventSource as any;
        if (!ES) {
          controller.error(
            new Error(
              "EventSource is not available in this runtime; provide a polyfill or use a different transport",
            ),
          );
          return;
        }

        let isClosed = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        let es: any;

        const cleanup = (mode: "close" | "error", error?: Error) => {
          if (isClosed) return;
          isClosed = true;

          if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
          }

          try {
            es?.close();
          } catch {
            // ignore
          }

          if (mode === "error") {
            controller.error(error ?? new Error("SSE connection error"));
          } else {
            controller.close();
          }
        };

        // Timeout
        timeout = setTimeout(() => {
          cleanup("error", new Error("Request timeout"));
        }, this.timeoutMs);

        // Abort
        abortSignal?.addEventListener(
          "abort",
          () => {
            cleanup("close");
          },
          { once: true },
        );

        // Connect SSE
        es = new ES(`${this.serverUrl}/api/events/${runId}`);
        es.onmessage = (event: { data: string }) => {
          if (isClosed) return;

          let chunk: UIMessageChunk;
          try {
            chunk = JSON.parse(event.data) as UIMessageChunk;
          } catch {
            return;
          }

          if (!chunk || typeof chunk !== "object" || !("type" in chunk)) {
            return;
          }

          try {
            controller.enqueue(chunk);
          } catch (enqueueError) {
            if (
              enqueueError instanceof TypeError &&
              (enqueueError.message.includes("closed") ||
                enqueueError.message.includes("Cannot enqueue"))
            ) {
              cleanup("close");
              return;
            }
            cleanup(
              "error",
              enqueueError instanceof Error
                ? enqueueError
                : new Error(String(enqueueError)),
            );
            return;
          }

          // Close on terminal chunks
          if (chunk.type === "text-end" || chunk.type === "data-end") {
            cleanup("close");
          }

          // If server emits an error chunk, surface as stream error.
          if (chunk.type === "error") {
            cleanup(
              "error",
              new Error(
                "errorText" in chunk && typeof chunk.errorText === "string"
                  ? chunk.errorText
                  : "Server error",
              ),
            );
          }
        };

        es.onerror = () => {
          cleanup("error", new Error("SSE connection error"));
        };
      },
    });
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}

export function createRemoteAIKitTransport(
  options: RemoteAIKitTransportOptions,
): RemoteAIKitTransport {
  return new RemoteAIKitTransport(options);
}
