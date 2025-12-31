/**
 * Event Context Types for Unified Event System
 *
 * Re-exports from @openharness/core for convenience.
 * SDK consumers can import from either @openharness/sdk or @openharness/core.
 *
 * @module harness/event-context
 */

// Re-export all event types from core
export type {
	// Context types
	AgentContext,
	EventContext,
	PhaseContext,
	TaskContext,

	// Base event types
	AgentCompleteEvent,
	AgentStartEvent,
	AgentTextEvent,
	AgentThinkingEvent,
	AgentToolCompleteEvent,
	AgentToolStartEvent,
	BaseEvent,
	BaseEventPayload,
	ExtensionEvent,
	HarnessCompleteEvent,
	HarnessStartEvent,
	NarrativeEvent,
	NarrativeImportance,
	PhaseCompleteEvent,
	PhaseStartEvent,
	SessionAbortEvent,
	SessionPromptEvent,
	SessionReplyEvent,
	TaskCompleteEvent,
	TaskFailedEvent,
	TaskStartEvent,

	// Enriched event
	EnrichedEvent,

	// Event bus types
	EventFilter,
	EventListener,
	IEventBus,
	Unsubscribe,
} from "@openharness/core";

// SDK-specific alias for event listener (matches SDK's existing API)
export type { EventListener as UnifiedEventListener } from "@openharness/core";
