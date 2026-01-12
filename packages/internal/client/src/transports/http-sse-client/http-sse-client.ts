import type { UIMessage } from "ai";
import type { RuntimeCommand } from "@internal/core";
import { ok, err } from "neverthrow";
import type { TransportResult } from "../errors.js";
import { parseJSON, fetchWithResult, TransportError } from "../errors.js";

/**
 * HTTP Server-Sent Events transport client for receiving runtime events.
 *
 * Handles connection lifecycle, automatic reconnection with exponential backoff,
 * and robust error handling for network failures and parsing errors.
 *
 * @example
 * ```ts
 * const client = new HTTPSSEClient({ serverUrl: 'http://localhost:3000' });
 *
 * await client.connect(runId, (event) => {
 *   console.log('Event received:', event);
 * });
 *
 * await client.sendCommand({ type: 'pause', runId });
 * client.disconnect();
 * ```
 */
export interface HTTPSSEClientOptions {
  /** Base server URL (trailing slash removed automatically) */
  serverUrl: string;
  /** Connection timeout in ms (default: 30 minutes) */
  timeout?: number;
  /** Initial reconnection delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Max reconnection attempts before giving up (default: 5) */
  maxReconnectAttempts?: number;
}

type EventSourceMessageEvent = { data: string };

interface EventSourceLike {
  onmessage: ((event: EventSourceMessageEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onopen?: (() => void) | null;
  close(): void;
}

type EventSourceConstructor = new (url: string) => EventSourceLike;

export class HTTPSSEClient {
  private readonly options: Required<HTTPSSEClientOptions>;
  private eventSource: EventSourceLike | undefined;

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private timeoutTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Create a new HTTP-SSE client.
   *
   * @param options - Client configuration with server URL and timeouts
   */
  constructor(options: HTTPSSEClientOptions) {
    this.options = {
      serverUrl: options.serverUrl.replace(/\/$/, ""),
      timeout: options.timeout ?? 30 * 60 * 1000,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
    };
  }

  /**
   * Connect to the server's event stream for a specific run.
   *
   * Establishes SSE connection and sets up automatic reconnection logic.
   * Calls onEvent for each parsed event received, with invalid events silently ignored.
   *
   * @param runId - Run ID to subscribe to events for
   * @param onEvent - Callback invoked for each successfully parsed event
   * @throws TransportError if EventSource is not available in runtime
   *
   * @example
   * ```ts
   * client.connect(runId, (event) => {
   *   if (event.type === 'node:complete') {
   *     console.log('Node completed:', event.nodeId);
   *   }
   * }).catch(err => console.error('Connection failed:', err));
   * ```
   */
  async connect(
    runId: string,
    onEvent: (event: unknown) => void,
  ): Promise<void> {
    const ES = (
      globalThis as unknown as { EventSource?: EventSourceConstructor }
    ).EventSource;
    if (!ES) {
      throw new TransportError(
        'NETWORK_ERROR',
        "EventSource is not available in this runtime; provide a polyfill or use a different transport",
      );
    }

    this.disconnect();

    const url = `${this.options.serverUrl}/api/events/${runId}`;
    this.eventSource = new ES(url);

    const bumpTimeout = () => {
      if (this.timeoutTimer) {
        clearTimeout(this.timeoutTimer);
      }
      this.timeoutTimer = setTimeout(() => {
        this.scheduleReconnect(runId, onEvent);
      }, this.options.timeout);
    };

    bumpTimeout();

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      bumpTimeout();
    };

    this.eventSource.onmessage = (event) => {
      bumpTimeout();

      const result = parseJSON<unknown>(event.data);
      result.match(
        (parsedEvent) => onEvent(parsedEvent),
        () => {
          // Silently ignore invalid events
        },
      );
    };

    this.eventSource.onerror = () => {
      this.scheduleReconnect(runId, onEvent);
    };
  }

  /**
   * Send a runtime command to the server.
   *
   * @param command - Runtime command to send (pause, resume, stop)
   * @returns Promise resolving to Result succeeding on successful send, or TransportError on failure
   *
   * @example
   * ```ts
   * const result = await client.sendCommand({
   *   type: 'pause',
   * });
   *
   * result.match(
   *   () => console.log('Command sent'),
   *   (err) => console.error('Failed:', err.message)
   * );
   * ```
   */
  async sendCommand(command: RuntimeCommand): Promise<TransportResult<void>> {
    const res = await fetchWithResult(`${this.options.serverUrl}/api/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });

    return res.map(() => {
      // Success - return void
    });
  }

  /**
   * Start a new chat session and receive a run ID.
   *
   * @param messages - Initial message history
   * @returns Promise resolving to Result containing run ID or TransportError on failure
   *
   * @example
   * ```ts
   * const result = await client.startChat([
   *   { role: 'user', content: 'Hello' }
   * ]);
   *
   * result.match(
   *   ({ runId }) => console.log('Started run:', runId),
   *   (err) => console.error('Chat failed:', err.message)
   * );
   * ```
   */
  async startChat(messages: UIMessage[]): Promise<TransportResult<{ runId: string }>> {
    const res = await fetchWithResult(`${this.options.serverUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (res.isErr()) {
      return err(res.error);
    }

    const response = res.value;
    const text = await response.text();
    const parseResult = parseJSON<{ runId?: string }>(text);

    if (parseResult.isErr()) {
      const errResult: TransportResult<{ runId: string }> = err(parseResult.error);
      return errResult;
    }

    const json = parseResult.value;
    if (!json.runId || typeof json.runId !== 'string') {
      return err(
        new TransportError(
          'INVALID_RESPONSE',
          'Chat response missing or invalid runId',
        ),
      );
    }

    const result: TransportResult<{ runId: string }> = ok({ runId: json.runId });
    return result;
  }

  /**
   * Close the SSE connection and cancel any pending reconnection.
   *
   * Safe to call multiple times; clears all timers and event handlers.
   *
   * @example
   * ```ts
   * client.disconnect();
   * ```
   */
  disconnect(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = undefined;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {
        // ignore close errors
      }
      this.eventSource = undefined;
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   *
   * Used internally when connection errors occur. Respects maxReconnectAttempts limit.
   *
   * @param runId - Run ID to reconnect to
   * @param onEvent - Event callback to pass to reconnected client
   * @internal
   */
  private scheduleReconnect(
    runId: string,
    onEvent: (event: unknown) => void,
  ): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.disconnect();
      return;
    }

    this.disconnect();

    const delay = Math.min(
      this.options.reconnectDelay * 2 ** this.reconnectAttempts,
      30000,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      void this.connect(runId, onEvent);
    }, delay);
  }
}
