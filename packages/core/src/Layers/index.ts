/**
 * Layer exports - configurations for different environments.
 *
 * @module
 */

// In-memory implementations (standalone / testing)
export {
  InMemoryEventBus,
  InMemoryEventHub,
  InMemoryEventStore,
  InMemoryProviderRecorder,
  makeInMemoryProviderRecorder
} from "./InMemory.js"

// LibSQL-backed implementations (persistent storage)
export type { LibSQLEventStoreConfig } from "./LibSQL.js"
export { EventStoreLive } from "./LibSQL.js"
