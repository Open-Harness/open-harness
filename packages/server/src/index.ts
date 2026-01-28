/**
 * @open-scaffold/server - HTTP/SSE server for workflows.
 *
 * @module
 */

// Constants
export { DEFAULT_HOST, DEFAULT_PORT } from "./constants.js"

// Public API (no Effect knowledge required)
export { OpenScaffold, OpenScaffoldError } from "./OpenScaffold.js"

export type {
  OpenScaffoldConfig,
  OpenScaffoldServer,
  ProviderMode,
  ServerOptions,
  SessionInfo
} from "./OpenScaffold.js"

// Server (lower-level API, requires Effect knowledge)
export type { ServerConfig, ServerService } from "./http/Server.js"
export { createServer, makeInMemoryRecorderLayer, Server, ServerError } from "./http/Server.js"

// Routes
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

// SSE
export type { SSEMessage } from "./http/SSE.js"
export { eventStreamToSSE, formatSSEMessage, SSE_HEADERS } from "./http/SSE.js"

// Services
export { EventBusLive } from "./services/EventBusLive.js"

// Provider (Anthropic)
export type { AnthropicModel, AnthropicProviderConfig } from "./provider/Provider.js"
export { AnthropicProvider } from "./provider/Provider.js"

// Store
export type { LibSQLConfig } from "./store/Config.js"
export { EventStoreLive } from "./store/EventStoreLive.js"
export {
  ALTER_RECORDINGS_ADD_STREAM_TRANSCRIPT,
  CREATE_EVENTS_TABLE,
  CREATE_RECORDINGS_TABLE,
  CREATE_SESSIONS_TABLE,
  CREATE_STATE_SNAPSHOTS_TABLE,
  MIGRATIONS,
  runMigrations
} from "./store/Migrations.js"
export { ProviderRecorderLive } from "./store/ProviderRecorderLive.js"
export { StateSnapshotStoreLive } from "./store/StateSnapshotStoreLive.js"
