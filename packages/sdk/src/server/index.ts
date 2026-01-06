/**
 * Open Harness SDK - Server Components
 */

export type { EventsRouteOptions } from "./api-routes/index.js";
// API Routes
export {
  createAPIRoutes,
  createChatRoute,
  createCommandsRoute,
  createEventsRoute,
  createHealthRoute,
} from "./api-routes/index.js";

// Middleware
export { corsMiddleware } from "./middleware/cors.js";
export { errorHandler } from "./middleware/error-handler.js";
export type { SqliteRunStoreOptions } from "./persistence/sqlite-run-store.js";
// Persistence
export { SqliteRunStore } from "./persistence/sqlite-run-store.js";
export type {
  ClaudeAgentExtendedOptions,
  ClaudeAgentInput,
  ClaudeAgentOutput,
  ClaudeMessageInput,
  ClaudeNodeOptions,
} from "./providers/claude.agent.js";
// Providers
export {
  claudeNode,
  createClaudeNode,
  resolveOutputSchema,
} from "./providers/claude.agent.js";
// Testing utilities
export {
  createMockQuery,
  type FixtureCall,
  type FixtureFile,
  type FixtureSet,
} from "./providers/testing/mock-query.js";
export {
  createLocalAIKitTransport,
  LocalAIKitTransport,
} from "./transports/ai-sdk-local-transport.js";
export { createPartTracker, transformEvent } from "./transports/transforms.js";
export type {
  FlowStatusData,
  NodeOutputData,
  OpenHarnessChatTransportOptions,
  OpenHarnessDataTypes,
  PartTracker,
  TransformFunction,
} from "./transports/types.js";
// Transports
export {
  WebSocketTransport,
  type WebSocketTransportOptions,
} from "./transports/websocket.js";
