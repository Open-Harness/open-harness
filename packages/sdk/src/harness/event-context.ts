/**
 * Event Context Types for Unified Event System
 *
 * These types define the hierarchical context that propagates through
 * AsyncLocalStorage during harness execution. Events automatically
 * inherit context without explicit parameter passing.
 *
 * @module harness/event-context
 */

// ============================================================================
// CONTEXT TYPES (FR-003)
// ============================================================================

/**
 * Phase scope metadata.
 */
export interface PhaseContext {
	/** Phase name (e.g., "Planning", "Implementation") */
	name: string;
	/** Optional phase number (1-indexed) */
	number?: number;
}

/**
 * Task scope metadata.
 */
export interface TaskContext {
	/** Task identifier (e.g., "T003") */
	id: string;
	/** Optional task description */
	description?: string;
}

/**
 * Agent scope metadata.
 */
export interface AgentContext {
	/** Agent name (e.g., "CodingAgent", "ReviewAgent") */
	name: string;
	/** Optional agent type (e.g., "anthropic", "openai") */
	type?: string;
}

/**
 * Full event context with all scope levels.
 * Propagated via AsyncLocalStorage.
 */
export interface EventContext {
	/** Session identifier (UUID), set at bus creation */
	sessionId: string;
	/** Optional phase scope */
	phase?: PhaseContext;
	/** Optional task scope */
	task?: TaskContext;
	/** Optional agent scope */
	agent?: AgentContext;
}

// ============================================================================
// BASE EVENT TYPES (FR-004)
// ============================================================================

/**
 * Base interface for all events.
 * Uses discriminated union pattern with `type` field.
 */
export interface BaseEventPayload {
	/** Discriminator for event type */
	type: string;
}

// --- Workflow Events ---

export interface HarnessStartEvent extends BaseEventPayload {
	type: "harness:start";
	sessionId: string;
	mode: "live" | "replay";
	taskCount: number;
}

export interface HarnessCompleteEvent extends BaseEventPayload {
	type: "harness:complete";
	success: boolean;
	tasksCompleted: number;
	tasksFailed: number;
	duration: number;
}

export interface PhaseStartEvent extends BaseEventPayload {
	type: "phase:start";
	name: string;
	phaseNumber?: number;
}

export interface PhaseCompleteEvent extends BaseEventPayload {
	type: "phase:complete";
	name: string;
	phaseNumber?: number;
}

export interface TaskStartEvent extends BaseEventPayload {
	type: "task:start";
	taskId: string;
}

export interface TaskCompleteEvent extends BaseEventPayload {
	type: "task:complete";
	taskId: string;
	result?: unknown;
}

export interface TaskFailedEvent extends BaseEventPayload {
	type: "task:failed";
	taskId: string;
	error: string;
	stack?: string;
}

// --- Agent Events ---

export interface AgentStartEvent extends BaseEventPayload {
	type: "agent:start";
	agentName: string;
}

export interface AgentThinkingEvent extends BaseEventPayload {
	type: "agent:thinking";
	content: string;
}

export interface AgentTextEvent extends BaseEventPayload {
	type: "agent:text";
	content: string;
}

export interface AgentToolStartEvent extends BaseEventPayload {
	type: "agent:tool:start";
	toolName: string;
	input: unknown;
}

export interface AgentToolCompleteEvent extends BaseEventPayload {
	type: "agent:tool:complete";
	toolName: string;
	result: unknown;
	isError?: boolean;
}

export interface AgentCompleteEvent extends BaseEventPayload {
	type: "agent:complete";
	agentName: string;
	success: boolean;
}

// --- Narrative Events ---

export type NarrativeImportance = "critical" | "important" | "detailed";

export interface NarrativeEvent extends BaseEventPayload {
	type: "narrative";
	text: string;
	importance: NarrativeImportance;
}

// --- Session Events ---

export interface SessionPromptEvent extends BaseEventPayload {
	type: "session:prompt";
	prompt: string;
}

export interface SessionReplyEvent extends BaseEventPayload {
	type: "session:reply";
	reply: string;
}

export interface SessionAbortEvent extends BaseEventPayload {
	type: "session:abort";
	reason: string;
}

// --- Extension Pattern ---

/**
 * Extension event for custom event types.
 * Allows users to define additional event types without modifying core types.
 */
export interface ExtensionEvent extends BaseEventPayload {
	type: string;
	[key: string]: unknown;
}

/**
 * Union of all known event types.
 */
export type BaseEvent =
	| HarnessStartEvent
	| HarnessCompleteEvent
	| PhaseStartEvent
	| PhaseCompleteEvent
	| TaskStartEvent
	| TaskCompleteEvent
	| TaskFailedEvent
	| AgentStartEvent
	| AgentThinkingEvent
	| AgentTextEvent
	| AgentToolStartEvent
	| AgentToolCompleteEvent
	| AgentCompleteEvent
	| NarrativeEvent
	| SessionPromptEvent
	| SessionReplyEvent
	| SessionAbortEvent
	| ExtensionEvent;

// ============================================================================
// ENRICHED EVENT (FR-002)
// ============================================================================

/**
 * Enriched event wrapper with metadata.
 * Every event emitted through UnifiedEventBus is wrapped in this envelope.
 */
export interface EnrichedEvent<T extends BaseEventPayload = BaseEvent> {
	/** Unique event identifier (UUID) */
	id: string;
	/** When event was emitted */
	timestamp: Date;
	/** Inherited + override context */
	context: EventContext;
	/** Original event payload */
	event: T;
}

// ============================================================================
// EVENT BUS TYPES
// ============================================================================

/**
 * Event listener callback type.
 */
export type UnifiedEventListener<T extends BaseEventPayload = BaseEvent> = (
	event: EnrichedEvent<T>,
) => void | Promise<void>;

/**
 * Unsubscribe function returned by subscribe().
 */
export type Unsubscribe = () => void;

/**
 * Event filter - string pattern or array of patterns.
 * Supports: '*' (all), 'task:*' (prefix), exact match.
 */
export type EventFilter = string | string[];
