// Protocol: Events
// See docs/reference/protocol-types.md for authoritative definitions

// Context (hierarchical)
export interface EventContext {
	sessionId: string;
	phase?: { name: string; number?: number };
	task?: { id: string };
	agent?: { name: string; type?: string };
}

// Base event payloads
export type WorkflowEvents =
	| { type: "harness:start"; name: string }
	| { type: "harness:complete"; success: boolean; durationMs: number }
	| { type: "phase:start"; name: string; phaseNumber?: number }
	| { type: "phase:complete"; name: string; phaseNumber?: number }
	| {
			type: "phase:failed";
			name: string;
			error: string;
			stack?: string;
			phaseNumber?: number;
	  }
	| { type: "task:start"; taskId: string }
	| { type: "task:complete"; taskId: string; result?: unknown }
	| { type: "task:failed"; taskId: string; error: string; stack?: string };

export type AgentEvents =
	| { type: "agent:start"; agentName: string; runId: string }
	| { type: "agent:thinking"; content: string; runId?: string }
	| { type: "agent:text"; content: string; runId?: string }
	| {
			type: "agent:tool:start";
			toolName: string;
			input?: unknown;
			runId?: string;
	  }
	| {
			type: "agent:tool:complete";
			toolName: string;
			result?: unknown;
			isError?: boolean;
			runId?: string;
	  }
	| {
			type: "agent:complete";
			agentName: string;
			success: boolean;
			runId: string;
	  };

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
	allowText?: boolean;
};

export type SessionReplyEvent = {
	type: "session:reply";
	promptId: string;
	content: string;
	choice?: string;
};
export type SessionAbortEvent = { type: "session:abort"; reason?: string };

/**
 * Emitted when a resumable pause is requested.
 * Contains session state info for external systems.
 */
export type FlowPausedEvent = {
	type: "flow:paused";
	sessionId: string;
	nodeId: string;
	reason?: string;
};

/**
 * Emitted when a paused session resumes execution.
 */
export type FlowResumedEvent = {
	type: "flow:resumed";
	sessionId: string;
	nodeId: string;
	injectedMessages: number;
};

export type SessionStartEvent = {
	type: "session:start";
	sessionId: string;
	parentSessionId?: string;
	nodeId: string;
};

export type SessionEndEvent = {
	type: "session:end";
	sessionId: string;
	nodeId: string;
};
export type NarrativeEvent = {
	type: "narrative";
	text: string;
	importance?: "low" | "normal" | "high";
};

export type ChannelEvents =
	| { type: "channel:registered"; name: string }
	| { type: "channel:started"; name: string }
	| { type: "channel:stopped"; name: string }
	| { type: "channel:unregistered"; name: string }
	| { type: "channel:error"; name: string; error: string };

/** Node-level execution events for visualization (ReactFlow) */
export type NodeEvents =
	| { type: "node:start"; nodeId: string; nodeType: string }
	| {
			type: "node:complete";
			nodeId: string;
			output: unknown;
			durationMs: number;
	  }
	| { type: "node:error"; nodeId: string; error: string; stack?: string }
	| { type: "node:skipped"; nodeId: string; reason: "when" | "edge" };

export type ExtensionEvent = { type: string; [k: string]: unknown };

export type BaseEvent =
	| WorkflowEvents
	| AgentEvents
	| SessionMessageEvent
	| SessionPromptEvent
	| SessionReplyEvent
	| SessionAbortEvent
	| FlowPausedEvent
	| FlowResumedEvent
	| SessionStartEvent
	| SessionEndEvent
	| NarrativeEvent
	| ChannelEvents
	| NodeEvents
	| ExtensionEvent;

// Enriched envelope
export interface EnrichedEvent<T extends BaseEvent = BaseEvent> {
	id: string;
	timestamp: Date;
	context: EventContext;
	event: T;
}

// Filtering
export type EventFilter = "*" | string | string[];
export type EventListener<T extends BaseEvent = BaseEvent> = (
	event: EnrichedEvent<T>,
) => void | Promise<void>;
export type Unsubscribe = () => void;
