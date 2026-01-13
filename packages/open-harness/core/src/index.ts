export * from "@internal/core";

// v0.3.0: nodes module deleted - use Harness pattern from @internal/signals-core instead

// Re-export signal infrastructure for public API
// v0.3.0: All signal types now exported - old recording types deleted
export {
	attachReporter,
	attachReporters,
	type Checkpoint,
	// Pattern matching utilities
	compilePattern,
	createConsoleReporter,
	createEmptySnapshot,
	createMetricsReporter,
	type HarnessState,
	type ISignalBus,
	// Stores - Signal recording/replay
	MemorySignalStore,
	matchesAnyPattern,
	matchesPattern,
	// Player - Navigate recordings (VCR-style)
	Player,
	type PlayerPosition,
	type PlayerState,
	type Recording,
	type RecordingMetadata,
	type RecordingQuery,
	// SignalBus - Central event dispatcher
	SignalBus,
	type SignalBusOptions,
	type SignalHandler,
	// Pattern matching
	type SignalPattern,
	// Reporters
	type SignalReporter,
	type SignalStore,
	// Snapshot - State at any point
	type Snapshot,
	snapshot,
	snapshotAll,
	type Unsubscribe,
} from "@internal/signals";
// Re-export signal primitives from @internal/signals-core
export {
	createSignal,
	// Harness types (v0.3.0: renamed from Provider)
	HARNESS_SIGNALS,
	type Harness,
	type HarnessCapabilities,
	type HarnessInput,
	type HarnessOutput,
	isSignal,
	type Message,
	type RunContext,
	type Signal,
	type SignalSource,
	type TokenUsage,
	type ToolCall,
	type ToolDefinition,
	type ToolResult,
} from "@internal/signals-core";
// Re-export Claude harness for public API (v0.3.0: renamed from provider)
export {
	ClaudeHarness,
	type ClaudeHarnessConfig,
	type ClaudeHarnessInput,
	type ClaudeHarnessOutput,
} from "@open-harness/claude";
// Re-export OpenAI/Codex harness for public API (v0.3.0: renamed from provider)
export {
	CodexHarness,
	type CodexHarnessConfig,
	type CodexHarnessInput,
	type CodexHarnessOutput,
} from "@open-harness/openai";
