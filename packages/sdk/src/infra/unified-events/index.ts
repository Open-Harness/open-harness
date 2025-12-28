/**
 * Unified Event System
 *
 * Central export point for the unified event bus and related types.
 * This module provides a single subscription API for both workflow events
 * (phase, task) and agent events (thinking, tool calls).
 *
 * @module core/unified-events
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
	AgentCompleteEvent,
	AgentContext,
	AgentStartEvent,
	AgentTextEvent,
	AgentThinkingEvent,
	AgentToolCompleteEvent,
	AgentToolStartEvent,
	// Transport types (010-transport-architecture)
	Attachment,
	BaseEvent,
	// Base event types (FR-004)
	BaseEventPayload,
	Cleanup,
	// Enriched event (FR-002)
	EnrichedEvent,
	// Context types (FR-003)
	EventContext,
	EventFilter,
	EventListener,
	ExtensionEvent,
	HarnessCompleteEvent,
	HarnessStartEvent,
	InjectedMessage,
	// Session context interface
	ISessionContext,
	// Event bus types (FR-001)
	IUnifiedEventBus,
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
	// Transport types
	Transport,
	TransportStatus,
	UnifiedEventListener,
	Unsubscribe,
	UserResponse,
	WaitOptions,
} from "./types.js";

// ============================================================================
// UTILITIES
// ============================================================================

export { matchesFilter } from "./filter.js";

// Zod schemas for runtime validation
export { isAgentEvent, isNarrativeEvent, isSessionEvent, isWorkflowEvent, UserResponseSchema } from "./types.js";
