/**
 * Open Harness SDK - Server Components
 */

// Transports
export {
  WebSocketTransport,
  type WebSocketTransportOptions,
} from "./transports/websocket.js";
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

// Providers
export {
  claudeNode,
  createClaudeNode,
  resolveOutputSchema,
} from "./providers/claude.agent.js";
export type {
  ClaudeAgentExtendedOptions,
  ClaudeAgentInput,
  ClaudeAgentOutput,
  ClaudeMessageInput,
  ClaudeNodeOptions,
} from "./providers/claude.agent.js";

// Testing utilities
export {
  createMockQuery,
  type FixtureCall,
  type FixtureFile,
  type FixtureSet,
} from "./providers/testing/mock-query.js";

// Persistence
export { SqliteRunStore } from "./persistence/sqlite-run-store.js";
export type { SqliteRunStoreOptions } from "./persistence/sqlite-run-store.js";
