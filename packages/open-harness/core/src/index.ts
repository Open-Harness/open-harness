export * from "@internal/core";

// v0.3.0: nodes module deleted - use Provider pattern from @signals/core instead

// Re-export signal infrastructure for public API
// v0.3.0: All signal types now exported - old recording types deleted
export {
	attachReporter,
	attachReporters,
	type Checkpoint,
	createConsoleReporter,
	createEmptySnapshot,
	createMetricsReporter,
	type ISignalBus,
	// Stores - Signal recording/replay
	MemorySignalStore,
	matchesAnyPattern,
	matchesPattern,
	// Player - Navigate recordings (VCR-style)
	Player,
	type PlayerPosition,
	type PlayerState,
	type ProviderState,
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
} from "@signals/bus";
// Re-export signal primitives from @signals/core
export {
	createSignal,
	isSignal,
	type Message,
	// Provider types
	PROVIDER_SIGNALS,
	type Provider,
	type ProviderCapabilities,
	type ProviderInput,
	type ProviderOutput,
	type RunContext,
	type Signal,
	type SignalSource,
	type TokenUsage,
	type ToolCall,
	type ToolDefinition,
	type ToolResult,
} from "@signals/core";
// Re-export Claude provider for public API
export {
	ClaudeProvider,
	type ClaudeProviderConfig,
	type ClaudeProviderInput,
	type ClaudeProviderOutput,
} from "@signals/provider-claude";
// Re-export OpenAI/Codex provider for public API
export {
	CodexProvider,
	type CodexProviderConfig,
	type CodexProviderInput,
	type CodexProviderOutput,
} from "@signals/provider-openai";
