/**
 * @internal/signals
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
// Console Reporter - Debug logging
export {
	type ConsoleReporterOptions,
	createConsoleReporter,
	defaultConsoleReporter,
} from "./console-reporter.js";
// MemorySignalStore - In-memory implementation
export { MemorySignalStore } from "./memory-store.js";
// Metrics Reporter - Aggregated metrics collection
export {
	type AggregatedMetrics,
	createMetricsReporter,
	type MetricsReporterOptions,
	type MetricsSignalReporter,
} from "./metrics-reporter.js";
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

// Reporters - Signal-based reporting interface
export {
	attachReporter,
	attachReporters,
	type ReporterContext,
	type SignalReporter,
} from "./reporter.js";
// Snapshot - Point-in-time state derivation
export {
	applySignal,
	createEmptySnapshot,
	type HarnessState,
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
