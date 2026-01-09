/**
 * @signals/bus
 *
 * Signal routing, storage, and playback for the Open Harness reactive architecture.
 */

// SignalBus - Central event dispatcher
export {
	type ISignalBus,
	SignalBus,
	type SignalBusOptions,
	type SignalHandler,
	type Unsubscribe,
} from "./bus.js";
// MemorySignalStore - In-memory implementation
export { MemorySignalStore } from "./memory-store.js";
// Pattern matching
export {
	type CompiledPattern,
	compilePattern,
	globToRegex,
	matchesAnyPattern,
	matchesPattern,
	type SignalPattern,
} from "./patterns.js";
// Player - Navigate recordings
export { Player, type PlayerPosition, type PlayerState } from "./player.js";

// Snapshot - Point-in-time state derivation
export {
	applySignal,
	createEmptySnapshot,
	type ProviderState,
	type Snapshot,
	snapshot,
	snapshotAll,
	type TextAccumulator,
	type ToolCallState,
} from "./snapshot.js";
// SignalStore - Persistent storage
export type {
	Checkpoint,
	Recording,
	RecordingMetadata,
	RecordingQuery,
	SignalStore,
} from "./store.js";

// Reporters - Signal-based reporting interface
export {
	attachReporter,
	attachReporters,
	type ReporterContext,
	type SignalReporter,
} from "./reporter.js";

// Console Reporter - Debug logging
export {
	createConsoleReporter,
	type ConsoleReporterOptions,
	defaultConsoleReporter,
} from "./console-reporter.js";

// Metrics Reporter - Aggregated metrics collection
export {
	createMetricsReporter,
	type AggregatedMetrics,
	type MetricsReporterOptions,
	type MetricsSignalReporter,
} from "./metrics-reporter.js";
