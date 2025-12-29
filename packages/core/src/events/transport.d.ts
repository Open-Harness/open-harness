/**
 * Transport Types - Pino-inspired event transport pattern
 *
 * Following the Pino/Winston logging pattern:
 * - EventHub: The source (like Logger) - bidirectional hub for events
 * - Transport: A destination (like pino-pretty) - receives and processes events
 *
 * @module @openharness/core/events/transport
 */
import type { EnrichedEvent, EventFilter, Unsubscribe } from "./types.js";
/**
 * Status of a transport connection.
 */
export type TransportStatus = "connecting" | "connected" | "disconnected" | "error";
/**
 * EventHub - Bidirectional event hub interface
 *
 * This is what harness instances implement. It's bidirectional:
 * - Outbound: subscribe() to receive events
 * - Inbound: reply(), send(), abort() to send commands back
 *
 * Named "EventHub" (not "EventSource") because it's bidirectional.
 */
export interface EventHub {
    /**
     * Subscribe to events matching filter.
     * @param filter - Event type filter (optional, defaults to all)
     * @param listener - Callback for matching events
     * @returns Unsubscribe function
     */
    subscribe(filter: EventFilter | undefined, listener: (event: EnrichedEvent) => void | Promise<void>): Unsubscribe;
    /**
     * Send a message to the workflow.
     * @param message - Message to send
     */
    send(message: unknown): void;
    /**
     * Send a message to a specific agent.
     * @param agent - Agent name
     * @param message - Message to send
     */
    sendTo(agent: string, message: unknown): void;
    /**
     * Reply to a pending prompt.
     * @param promptId - ID of the prompt to reply to
     * @param response - Response content
     */
    reply(promptId: string, response: string): void;
    /**
     * Abort the session.
     * @param reason - Optional abort reason
     */
    abort(reason?: string): void;
    /**
     * Current transport status.
     */
    readonly status: TransportStatus;
    /**
     * Whether a session is currently active.
     */
    readonly sessionActive: boolean;
}
/**
 * Cleanup function returned by transport attachment.
 */
export type Cleanup = () => void;
/**
 * Transport - Event destination factory
 *
 * A Transport is a function that receives an EventHub and returns a cleanup function.
 * This follows the Pino pattern where transports are factories that subscribe to events.
 *
 * @example
 * ```typescript
 * const consoleTransport: Transport = (hub) => {
 *   const unsub = hub.subscribe(undefined, (event) => {
 *     console.log(formatEvent(event));
 *   });
 *   return unsub;
 * };
 *
 * // Usage
 * const harness = defineHarness({ ... })
 *   .attach(consoleTransport);
 * ```
 */
export type Transport = (hub: EventHub) => Cleanup;
/**
 * Common options for transport factories.
 */
export interface TransportOptions {
    /** Event filter (defaults to all events) */
    filter?: EventFilter;
}
/**
 * Console transport options.
 */
export interface ConsoleTransportOptions extends TransportOptions {
    /** Enable colored output */
    colors?: boolean;
    /** Show timestamps */
    timestamps?: boolean;
    /** Show event context */
    showContext?: boolean;
}
/**
 * WebSocket transport options.
 */
export interface WebSocketTransportOptions extends TransportOptions {
    /** WebSocket server port */
    port: number;
    /** Server hostname (default: localhost) */
    host?: string;
    /** Path for WebSocket endpoint (default: /events) */
    path?: string;
}
/**
 * HTTP transport options.
 */
export interface HttpTransportOptions extends TransportOptions {
    /** HTTP endpoint URL */
    url: string;
    /** HTTP method (default: POST) */
    method?: "POST" | "PUT";
    /** Additional headers */
    headers?: Record<string, string>;
    /** Batch events (default: true) */
    batch?: boolean;
    /** Batch flush interval in ms (default: 1000) */
    flushInterval?: number;
}
/**
 * Interface for objects that can have transports attached.
 */
export interface Attachable {
    /**
     * Attach a transport to receive events.
     * @param transport - Transport factory function
     * @returns this for chaining
     */
    attach(transport: Transport): this;
}
