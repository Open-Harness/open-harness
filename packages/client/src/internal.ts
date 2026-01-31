/**
 * @internal
 * Advanced/internal exports for @open-harness/client.
 * These are implementation details and may change without notice.
 *
 * @module
 */

// SSE reconnection schedule
export { sseReconnectSchedule } from "./Reconnect.js"

// SSE parsing utilities
export type { ParsedSSEMessage } from "./SSE.js"
export { createSSEStream, parseSSEMessage } from "./SSE.js"
