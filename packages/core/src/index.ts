/**
 * @openharness/core
 *
 * Core interfaces, event types, and DI infrastructure for the Open Harness SDK.
 *
 * This package contains no implementations - only types and interfaces.
 * All other @openharness packages depend on core.
 *
 * @module @openharness/core
 */

// ============================================================================
// Interfaces
// ============================================================================

export type {
	// Agent interfaces
	IAgent,
	IAgentRunner,
	RunnerOptions,
	RunArgs,
	RunnerCallbacks,
	AgentEvent,
	// Callback interfaces
	IAgentCallbacks,
	AgentStartMetadata,
	AgentResult,
	TokenUsage,
	ToolCallEvent,
	ToolResultEvent,
	ProgressEvent,
	AgentError,
	NarrativeConfig,
} from "./interfaces/index.js";

// ============================================================================
// Events
// ============================================================================

export type {
	// Context types
	PhaseContext,
	TaskContext,
	AgentContext,
	EventContext,
	// Base event types
	BaseEventPayload,
	HarnessStartEvent,
	HarnessCompleteEvent,
	PhaseStartEvent,
	PhaseCompleteEvent,
	TaskStartEvent,
	TaskCompleteEvent,
	TaskFailedEvent,
	AgentStartEvent,
	AgentThinkingEvent,
	AgentTextEvent,
	AgentToolStartEvent,
	AgentToolCompleteEvent,
	AgentCompleteEvent,
	NarrativeEvent,
	NarrativeImportance,
	SessionPromptEvent,
	SessionReplyEvent,
	SessionAbortEvent,
	ExtensionEvent,
	BaseEvent,
	// Enriched event
	EnrichedEvent,
	// Event bus types
	EventListener,
	Unsubscribe,
	EventFilter,
	IEventBus,
	// Transport pattern
	TransportStatus,
	EventHub,
	Cleanup,
	Transport,
	TransportOptions,
	ConsoleTransportOptions,
	WebSocketTransportOptions,
	HttpTransportOptions,
	Attachable,
} from "./events/index.js";

// ============================================================================
// DI
// ============================================================================

export {
	// Re-exported from needle-di
	Container,
	InjectionToken,
	inject,
	injectable,
	// Core tokens
	IConfigToken,
	IAgentRunnerToken,
	IEventBusToken,
} from "./di/index.js";

export type { IConfig, IContainer } from "./di/index.js";
