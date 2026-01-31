/**
 * Layer exports - configurations for different environments.
 *
 * Per CLAUDE.md "NO MOCKS" policy:
 * - Use LibSQL :memory: implementations for testing (real SQLite)
 * - InMemoryEventHub is PubSub-backed (real implementation, not a mock)
 * - EventBusLive is exported from Services/EventBus.ts
 *
 * @module
 */

// PubSub-backed EventHub (real implementation)
export { InMemoryEventHub } from "./InMemory.js"

// LibSQL-backed implementations (works with :memory: for testing)
export type { LibSQLConfig } from "./LibSQL.js"
export { EventStoreLive, ProviderRecorderLive } from "./LibSQL.js"
