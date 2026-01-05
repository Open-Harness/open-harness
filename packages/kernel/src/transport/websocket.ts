import type { ServerWebSocket } from "bun";
import type { RuntimeCommand, RuntimeEvent } from "../core/events.js";
import type { Runtime } from "../runtime/runtime.js";

/**
 * Transport interface for adapting runtime events/commands.
 */
export interface Transport {
  /** Start the transport. */
  start(): Promise<void>;
  /** Stop the transport. */
  stop(): Promise<void>;
}

/**
 * WebSocket transport options.
 *
 * @property {number} port - Listening port.
 * @property {string} [path] - WebSocket path.
 */
export interface WebSocketTransportOptions {
  port: number;
  path?: string;
}

/**
 * WebSocket transport adapter for the runtime.
 */
type WebSocketEnvelope =
  | { type: "event"; event: RuntimeEvent }
  | { type: "command"; command: RuntimeCommand };

export class WebSocketTransport implements Transport {
  private readonly runtime: Runtime;
  private readonly options: WebSocketTransportOptions;
  private readonly clients = new Set<ServerWebSocket<unknown>>();
  private server?: ReturnType<typeof Bun.serve>;
  private unsubscribe?: () => void;

  /**
   * Create a WebSocket transport.
   * @param runtime - Runtime instance.
   * @param options - Transport options.
   */
  constructor(runtime: Runtime, options: WebSocketTransportOptions) {
    this.runtime = runtime;
    this.options = options;
  }
  /** Start the transport. */
  async start(): Promise<void> {
    if (this.server) return;

    this.unsubscribe = this.runtime.onEvent((event) => {
      this.broadcast({ type: "event", event });
    });

    const path = this.options.path ?? "/ws";
    this.server = Bun.serve({
      port: this.options.port,
      fetch: (req, server) => {
        const url = new URL(req.url);
        if (url.pathname !== path) {
          return new Response("Not found", { status: 404 });
        }
        if (server.upgrade(req, { data: null })) {
          return;
        }
        return new Response("Upgrade required", { status: 426 });
      },
      websocket: {
        open: (ws) => {
          this.clients.add(ws);
        },
        message: (_ws, message) => {
          const payload = decodeMessage(message);
          if (!payload) return;
          if (payload.type === "command") {
            this.runtime.dispatch(payload.command);
          }
        },
        close: (ws) => {
          this.clients.delete(ws);
        },
      },
    });
  }
  /** Stop the transport. */
  async stop(): Promise<void> {
    if (!this.server) return;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.server.stop();
    this.server = undefined;
    this.clients.clear();
  }

  private broadcast(event: WebSocketEnvelope): void {
    const payload = JSON.stringify(event);
    for (const client of this.clients) {
      try {
        client.send(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }
}

function decodeMessage(message: string | Uint8Array): WebSocketEnvelope | null {
  const text =
    typeof message === "string" ? message : new TextDecoder().decode(message);
  try {
    const parsed = JSON.parse(text) as WebSocketEnvelope;
    if (parsed.type !== "command" && parsed.type !== "event") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
