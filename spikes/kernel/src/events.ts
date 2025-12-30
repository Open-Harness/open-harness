// Canonical event model for the spike kernel.

// ============================================================================
// Context (hierarchical)
// ============================================================================

export interface PhaseContext {
	name: string;
	number?: number;
}

export interface TaskContext {
	id: string;
	description?: string;
}

export interface AgentContext {
	name: string;
	type?: string;
}

export interface EventContext {
	sessionId: string;
	phase?: PhaseContext;
	task?: TaskContext;
	agent?: AgentContext;
}

// ============================================================================
// Events (payloads)
// ============================================================================

export interface BaseEventPayload {
	type: string;
}

export type WorkflowEvents =
	| { type: "harness:start"; name: string }
	| { type: "harness:complete"; success: boolean; durationMs: number }
	| { type: "phase:start"; name: string; phaseNumber?: number }
	| { type: "phase:complete"; name: string; phaseNumber?: number }
	| { type: "phase:failed"; name: string; error: string; stack?: string; phaseNumber?: number }
	| { type: "task:start"; taskId: string }
	| { type: "task:complete"; taskId: string; result?: unknown }
	| { type: "task:failed"; taskId: string; error: string; stack?: string };

export type AgentEvents =
	| { type: "agent:start"; agentName: string; runId: string }
	| { type: "agent:thinking"; content: string; runId?: string }
	| { type: "agent:text"; content: string; runId?: string }
	| { type: "agent:tool:start"; toolName: string; input?: unknown; runId?: string }
	| { type: "agent:tool:complete"; toolName: string; result?: unknown; isError?: boolean; runId?: string }
	| { type: "agent:complete"; agentName: string; success: boolean; runId: string };

// “Input lane” for bidirectional channels:
// - hub.send(...) emits this (general message into session)
// - hub.sendTo(agent, ...) emits this (message targeted at an agent)
export type SessionMessageEvent = {
	type: "session:message";
	content: string;
	agentName?: string;
	runId?: string;
};

export type SessionPromptEvent = {
	type: "session:prompt";
	promptId: string;
	prompt: string;
	choices?: string[];
	allowText?: boolean; // choices + free-text fallback
};

export type SessionReplyEvent = { type: "session:reply"; promptId: string; content: string; choice?: string };
export type SessionAbortEvent = { type: "session:abort"; reason?: string };

export type NarrativeEvent = { type: "narrative"; text: string; importance?: "low" | "normal" | "high" };

export type ExtensionEvent = BaseEventPayload & Record<string, unknown>;

export type BaseEvent =
	| WorkflowEvents
	| AgentEvents
	| SessionMessageEvent
	| SessionPromptEvent
	| SessionReplyEvent
	| SessionAbortEvent
	| NarrativeEvent
	| ExtensionEvent;

// ============================================================================
// Enriched envelope (always)
// ============================================================================

export interface EnrichedEvent<T extends BaseEventPayload = BaseEvent> {
	id: string;
	timestamp: Date;
	context: EventContext;
	event: T;
}

// ============================================================================
// Filtering / listeners
// ============================================================================

export type EventFilter = "*" | string | string[];

export type EventListener<T extends BaseEventPayload = BaseEvent> = (event: EnrichedEvent<T>) => void | Promise<void>;

export type Unsubscribe = () => void;
