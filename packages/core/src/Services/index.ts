/**
 * Internal services (Effect Context.Tag definitions).
 *
 * These are implementation details - users don't interact with them directly.
 *
 * @module
 */

// EventStore
export type { EventStoreService } from "./EventStore.js"
export { EventStore } from "./EventStore.js"

// StateSnapshotStore
export type { StateSnapshot, StateSnapshotStoreService } from "./StateSnapshotStore.js"
export { StateSnapshotStore } from "./StateSnapshotStore.js"

// StateCache
export type { StateCache, StateCacheConfig } from "./StateCache.js"
export { makeStateCache } from "./StateCache.js"

// EventBus
export type { EventBusService } from "./EventBus.js"
export { EventBus } from "./EventBus.js"

// AgentProvider
export type {
  AgentProviderService,
  AgentRunOptions,
  AgentRunResult,
  AgentStreamEvent,
  ProviderInfo
} from "./AgentProvider.js"
export { AgentProvider } from "./AgentProvider.js"

// ProviderRecorder (recording/playback for deterministic testing)
export type { ProviderRecorderService, RecordingEntry, RecordingEntryMeta } from "./ProviderRecorder.js"
export { ProviderRecorder } from "./ProviderRecorder.js"

// ProviderMode
export type { ProviderModeContextValue } from "./ProviderMode.js"
export { ProviderModeContext } from "./ProviderMode.js"
