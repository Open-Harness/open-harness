/**
 * Event Context Types for Unified Event System
 *
 * Re-exports from @openharness/core for convenience.
 * SDK consumers can import from either @openharness/sdk or @openharness/core.
 *
 * @module harness/event-context
 */

// Re-export all event types from core
// SDK-specific alias for event listener (matches SDK's existing API)
export type {
	// Base event types
	AgentCompleteEvent,
	// Context types
	AgentContext,
	AgentStartEvent,
	AgentTextEvent,
	AgentThinkingEvent,
	AgentToolCompleteEvent,
	AgentToolStartEvent,
	BaseEvent,
	BaseEventPayload,
	// Enriched event
	EnrichedEvent,
	EventContext,
	// Event bus types
	EventFilter,
	EventListener,
	EventListener as UnifiedEventListener,
	ExtensionEvent,
	HarnessCompleteEvent,
	HarnessStartEvent,
	IEventBus,
	NarrativeEvent,
	NarrativeImportance,
	PhaseCompleteEvent,
	PhaseContext,
	PhaseStartEvent,
	SessionAbortEvent,
	SessionPromptEvent,
	SessionReplyEvent,
	TaskCompleteEvent,
	TaskContext,
	TaskFailedEvent,
	TaskStartEvent,
	Unsubscribe,
} from "@openharness/core";
