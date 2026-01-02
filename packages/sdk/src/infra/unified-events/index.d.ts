/**
 * Unified Event System
 *
 * Central export point for the unified event bus and related types.
 * This module provides a single subscription API for both workflow events
 * (phase, task) and agent events (thinking, tool calls).
 *
 * @module core/unified-events
 */
export type { AgentCompleteEvent, AgentContext, AgentStartEvent, AgentTextEvent, AgentThinkingEvent, AgentToolCompleteEvent, AgentToolStartEvent, Attachment, BaseEvent, BaseEventPayload, Cleanup, EnrichedEvent, EventContext, EventFilter, EventListener, ExtensionEvent, HarnessCompleteEvent, HarnessStartEvent, InjectedMessage, ISessionContext, IUnifiedEventBus, NarrativeEvent, NarrativeImportance, PhaseCompleteEvent, PhaseContext, PhaseStartEvent, SessionAbortEvent, SessionPromptEvent, SessionReplyEvent, TaskCompleteEvent, TaskContext, TaskFailedEvent, TaskStartEvent, Transport, TransportStatus, UnifiedEventListener, Unsubscribe, UserResponse, WaitOptions, } from "./types.js";
export { matchesFilter } from "./filter.js";
export { isAgentEvent, isNarrativeEvent, isSessionEvent, isWorkflowEvent, UserResponseSchema } from "./types.js";
