/**
 * Unified Event Bus Types
 *
 * Interface and type definitions for the unified event system.
 * Re-exports context types from harness/event-context.ts for convenience.
 *
 * @module core/unified-events/types
 */

// Re-export all context and event types from harness
export type {
	AgentCompleteEvent,
	AgentContext,
	AgentStartEvent,
	AgentTextEvent,
	AgentThinkingEvent,
	AgentToolCompleteEvent,
	AgentToolStartEvent,
	BaseEvent,
	// Base event types
	BaseEventPayload,
	// Enriched event
	EnrichedEvent,
	// Context types
	EventContext,
	EventFilter,
	ExtensionEvent,
	HarnessCompleteEvent,
	HarnessStartEvent,
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
	// Listener types
	UnifiedEventListener,
	Unsubscribe,
} from "../../harness/event-context.js";

import type {
	AgentCompleteEvent,
	AgentStartEvent,
	AgentTextEvent,
	AgentThinkingEvent,
	AgentToolCompleteEvent,
	AgentToolStartEvent,
	BaseEvent,
	EventContext,
	EventFilter,
	HarnessCompleteEvent,
	HarnessStartEvent,
	NarrativeEvent,
	PhaseCompleteEvent,
	PhaseStartEvent,
	SessionAbortEvent,
	SessionPromptEvent,
	SessionReplyEvent,
	TaskCompleteEvent,
	TaskFailedEvent,
	TaskStartEvent,
	UnifiedEventListener,
	Unsubscribe,
} from "../../harness/event-context.js";

// ============================================================================
// TYPE GUARDS (FR-004)
// ============================================================================

/** Check if event is a workflow event (harness/phase/task) */
export function isWorkflowEvent(
	event: BaseEvent,
): event is
	| HarnessStartEvent
	| HarnessCompleteEvent
	| PhaseStartEvent
	| PhaseCompleteEvent
	| TaskStartEvent
	| TaskCompleteEvent
	| TaskFailedEvent {
	return event.type.startsWith("harness:") || event.type.startsWith("phase:") || event.type.startsWith("task:");
}

/** Check if event is an agent event */
export function isAgentEvent(
	event: BaseEvent,
): event is
	| AgentStartEvent
	| AgentThinkingEvent
	| AgentTextEvent
	| AgentToolStartEvent
	| AgentToolCompleteEvent
	| AgentCompleteEvent {
	return event.type.startsWith("agent:");
}

/** Check if event is a narrative event */
export function isNarrativeEvent(event: BaseEvent): event is NarrativeEvent {
	return event.type === "narrative";
}

/** Check if event is a session event */
export function isSessionEvent(event: BaseEvent): event is SessionPromptEvent | SessionReplyEvent | SessionAbortEvent {
	return event.type.startsWith("session:");
}

// ============================================================================
// UNIFIED EVENT BUS INTERFACE (FR-001)
// ============================================================================

/**
 * Unified Event Bus interface.
 * Central event infrastructure with AsyncLocalStorage context propagation.
 */
export interface IUnifiedEventBus {
	/**
	 * Execute function within a context scope.
	 * Context survives async boundaries via AsyncLocalStorage.
	 *
	 * @param context - Partial context to add/override
	 * @param fn - Function to execute within scope
	 * @returns Function result
	 */
	scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T>;

	/**
	 * Emit an event with auto-attached context.
	 *
	 * @param event - Event to emit
	 * @param override - Optional context override (merged with inherited)
	 */
	emit(event: BaseEvent, override?: Partial<EventContext>): void;

	/**
	 * Subscribe to events with optional filter.
	 *
	 * @param filter - Event type pattern(s). Default: '*' (all)
	 * @param listener - Callback for matching events
	 * @returns Unsubscribe function
	 */
	subscribe(listener: UnifiedEventListener): Unsubscribe;
	subscribe(filter: EventFilter, listener: UnifiedEventListener): Unsubscribe;

	/**
	 * Get current context from AsyncLocalStorage.
	 *
	 * @returns Current EventContext (minimal if no scope active)
	 */
	current(): EventContext;

	/**
	 * Remove all subscribers.
	 */
	clear(): void;

	/**
	 * Get number of active subscribers.
	 */
	readonly subscriberCount: number;
}
