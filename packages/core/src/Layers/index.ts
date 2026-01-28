/**
 * Layer exports - configurations for different environments.
 *
 * @module
 */

// Logger configurations
export {
  DebugLevelLayer,
  DevLoggerLayer,
  DevLoggingLayer,
  ErrorLevelLayer,
  ProdLoggerLayer,
  ProdLoggingLayer,
  TestLoggerLayer,
  TestLoggingLayer,
  WarnLevelLayer
} from "./Logger.js"

// In-memory implementations (standalone / testing)
export {
  InMemoryEventBus,
  InMemoryEventStore,
  InMemoryProviderRecorder,
  makeInMemoryProviderRecorder
} from "./InMemory.js"

// LibSQL-backed implementations (persistent storage)
export type { LibSQLEventStoreConfig } from "./LibSQL.js"
export { EventStoreLive } from "./LibSQL.js"
