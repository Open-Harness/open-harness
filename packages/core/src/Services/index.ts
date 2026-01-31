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
export type { StateSnapshotStoreService, StoredStateSnapshot } from "./StateSnapshotStore.js"
export { StateSnapshotStore } from "./StateSnapshotStore.js"

// StateCache
export type { StateCache, StateCacheConfig } from "./StateCache.js"
export { makeStateCache } from "./StateCache.js"

// EventBus
export type { EventBusService } from "./EventBus.js"
export { EventBus, EventBusLive } from "./EventBus.js"

// EventHub (ADR-004: PubSub-backed event emission)
export type { EventHubService } from "./EventHub.js"
export { EventHub, EventHubLive, makeEventHub } from "./EventHub.js"

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

// StateProjection (ADR-006: Event-sourced state derivation)
export type { StateProjectionService } from "./StateProjection.js"
export { makeStateProjection, StateProjection, StateProjectionLive } from "./StateProjection.js"
