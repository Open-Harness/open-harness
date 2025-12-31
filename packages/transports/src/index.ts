/**
 * @openharness/transports
 *
 * Transport implementations for the Open Harness SDK.
 *
 * Transports are event destinations that receive events from the harness
 * and do something with them (output to console, send over network, etc).
 *
 * Following the Pino/Winston pattern:
 * - EventHub: The source (harness emits events)
 * - Transport: A factory function that subscribes to events
 *
 * @example
 * ```typescript
 * import { defineHarness } from "@openharness/sdk";
 * import { consoleTransport } from "@openharness/transports";
 *
 * const harness = defineHarness({ ... })
 *   .attach(consoleTransport({ colors: true }))
 *   .attach(wsTransport({ port: 8080 }));  // future
 *
 * await harness.run();
 * ```
 *
 * @module @openharness/transports
 */

// ============================================================================
// Console Transport
// ============================================================================

export { consoleTransport, type ConsoleTransportOptions } from "./console/index.js";

// ============================================================================
// Re-exports from Core (convenience)
// ============================================================================

export type {
	Cleanup,
	EventHub,
	Transport,
	TransportOptions,
	TransportStatus,
} from "@openharness/core";

// ============================================================================
// Future Transports (placeholders)
// ============================================================================

// export { wsTransport } from "./websocket/index.js";
// export { httpTransport } from "./http/index.js";
// export { sseTransport } from "./sse/index.js";
