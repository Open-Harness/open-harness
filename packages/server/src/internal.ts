/**
 * @internal
 * Advanced/internal exports for @open-scaffold/server
 * These are implementation details and may change without notice.
 *
 * @module
 */

// Route handlers
export type { RouteContext, RouteResponse } from "./http/Routes.js"
export {
  createSessionRoute,
  deleteRecordingRoute,
  deleteSessionRoute,
  getProviderStatusRoute,
  getRecordingRoute,
  getSessionEventsRoute,
  getSessionRoute,
  getSessionStateRoute,
  listRecordingsRoute,
  listSessionsRoute,
  postSessionInputRoute
} from "./http/Routes.js"

// Server implementation details
export type { ServerConfig, ServerService } from "./http/Server.js"
export { createServer, makeInMemoryRecorderLayer, Server, ServerError } from "./http/Server.js"

// SSE utilities
export type { SSEMessage } from "./http/SSE.js"
export { eventStreamToSSE, formatSSEMessage, SSE_HEADERS } from "./http/SSE.js"

// Store implementations
export * from "./store/index.js"

// Programs (server-side business logic)
export * from "./programs/index.js"
