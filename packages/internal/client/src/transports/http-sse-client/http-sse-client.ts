import type { UIMessage } from "ai";
import type { RuntimeCommand } from "@internal/core";

export interface HTTPSSEClientOptions {
  serverUrl: string;
  timeout?: number;
  reconnectDelay?: number;
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

  constructor(options: HTTPSSEClientOptions) {
    this.options = {
      serverUrl: options.serverUrl.replace(/\/$/, ""),
      timeout: options.timeout ?? 30 * 60 * 1000,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
    };
  }

  async connect(
    runId: string,
    onEvent: (event: unknown) => void,
  ): Promise<void> {
    const ES = (
      globalThis as unknown as { EventSource?: EventSourceConstructor }
    ).EventSource;
    if (!ES) {
      throw new Error(
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

      try {
        onEvent(JSON.parse(event.data) as unknown);
      } catch {
        // ignore invalid events
      }
    };

    this.eventSource.onerror = () => {
      this.scheduleReconnect(runId, onEvent);
    };
  }

  async sendCommand(command: RuntimeCommand): Promise<void> {
    const res = await fetch(`${this.options.serverUrl}/api/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Command failed (${res.status} ${res.statusText})${text ? `: ${text}` : ""}`,
      );
    }
  }

  async startChat(messages: UIMessage[]): Promise<{ runId: string }> {
    const res = await fetch(`${this.options.serverUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Chat request failed (${res.status} ${res.statusText})${text ? `: ${text}` : ""}`,
      );
    }

    const json = (await res.json()) as { runId?: string };
    if (!json.runId) {
      throw new Error("Chat response missing runId");
    }
    return { runId: json.runId };
  }

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
        // ignore
      }
      this.eventSource = undefined;
    }
  }

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
