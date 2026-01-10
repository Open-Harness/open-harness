export * from "@internal/core";

// v0.3.0: nodes module deleted - use Provider pattern from @signals/core instead

// Re-export signal infrastructure for public API
// v0.3.0: All signal types now exported - old recording types deleted
export {
	// SignalBus - Central event dispatcher
	SignalBus,
	type ISignalBus,
	type SignalBusOptions,
	type SignalHandler,
	type Unsubscribe,
	// Stores - Signal recording/replay
	MemorySignalStore,
	type SignalStore,
	type Recording,
	type RecordingMetadata,
	type RecordingQuery,
	type Checkpoint,
	// Player - Navigate recordings (VCR-style)
	Player,
	type PlayerPosition,
	type PlayerState,
	// Pattern matching
	type SignalPattern,
	matchesPattern,
	matchesAnyPattern,
	// Snapshot - State at any point
	type Snapshot,
	type ProviderState,
	snapshot,
	snapshotAll,
	createEmptySnapshot,
	// Reporters
	type SignalReporter,
	attachReporter,
	attachReporters,
	createConsoleReporter,
	createMetricsReporter,
} from "@signals/bus";

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

// Re-export signal primitives from @signals/core
export {
	createSignal,
	isSignal,
	type Signal,
	type SignalSource,
	// Provider types
	PROVIDER_SIGNALS,
	type Provider,
	type ProviderCapabilities,
	type ProviderInput,
	type ProviderOutput,
	type RunContext,
	type TokenUsage,
	type ToolCall,
	type ToolDefinition,
	type ToolResult,
	type Message,
} from "@signals/core";
