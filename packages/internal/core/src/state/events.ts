import type { StatePatch } from "./state.js";

export type ClaudeMessageInput =
	| string
	| {
			message?: Record<string, unknown>;
			content?: string;
			parentToolUseId?: string | null;
			isSynthetic?: boolean;
			toolUseResult?: unknown;
	  };

/** Runtime lifecycle status for a flow execution. */
export type RuntimeStatus = "idle" | "running" | "paused" | "aborted" | "complete";

/**
 * Commands ingested by the runtime (from UI, CLI, or other adapters).
 *
 * Variants:
 * - pause: soft stop, resumable
 * - resume: continue a paused run with an optional message
 * - stop: hard stop, not resumable
 */
export type RuntimeCommand =
	| { type: "pause" }
	| { type: "resume"; message?: string }
	| { type: "stop" };

export type AgentStartEventPayload = {
	type: "agent:start";
	nodeId: string;
	runId: string;
	sessionId: string;
	model?: string;
	prompt: string | ClaudeMessageInput[];
};

export type AgentThinkingEventPayload = {
	type: "agent:thinking";
	nodeId: string;
	runId: string;
	content: string;
	tokenCount?: number;
};

export type AgentThinkingDeltaEventPayload = {
	type: "agent:thinking:delta";
	nodeId: string;
	runId: string;
	content: string;
	tokenCount?: number;
};

export type AgentTextEventPayload = {
	type: "agent:text";
	nodeId: string;
	runId: string;
	content: string;
};

export type AgentTextDeltaEventPayload = {
	type: "agent:text:delta";
	nodeId: string;
	runId: string;
	content: string;
};

export type AgentToolEventPayload = {
	type: "agent:tool";
	nodeId: string;
	runId: string;
	toolName: string;
	toolInput: unknown;
	toolOutput: unknown;
	durationMs?: number;
	error?: string;
};

export type AgentErrorEventPayload = {
	type: "agent:error";
	nodeId: string;
	runId: string;
	errorType: string;
	message: string;
	details?: unknown;
};

export type AgentCompleteEventPayload = {
	type: "agent:complete";
	nodeId: string;
	runId: string;
	result: string;
	structuredOutput?: unknown;
	usage: {
		inputTokens: number;
		outputTokens: number;
		cacheCreationInputTokens?: number;
		cacheReadInputTokens?: number;
	};
	modelUsage?: Record<string, { inputTokens: number; outputTokens: number }>;
	totalCostUsd?: number;
	durationMs: number;
	numTurns: number;
};

export type AgentPausedEventPayload = {
	type: "agent:paused";
	nodeId: string;
	runId: string;
	// Note: partialText removed in favor of consumer-side accumulation from agent:text:delta events
	// SDK maintains full conversation history via sessionId for resume - see issue #78
	sessionId?: string;
	numTurns?: number;
};

export type AgentAbortedEventPayload = {
	type: "agent:aborted";
	nodeId: string;
	runId: string;
	reason?: string;
};

export type AgentStartEvent = AgentStartEventPayload & { timestamp: number };
export type AgentThinkingEvent = AgentThinkingEventPayload & {
	timestamp: number;
};
export type AgentThinkingDeltaEvent = AgentThinkingDeltaEventPayload & {
	timestamp: number;
};
export type AgentTextEvent = AgentTextEventPayload & { timestamp: number };
export type AgentTextDeltaEvent = AgentTextDeltaEventPayload & {
	timestamp: number;
};
export type AgentToolEvent = AgentToolEventPayload & { timestamp: number };
export type AgentErrorEvent = AgentErrorEventPayload & { timestamp: number };
export type AgentCompleteEvent = AgentCompleteEventPayload & {
	timestamp: number;
};
export type AgentPausedEvent = AgentPausedEventPayload & { timestamp: number };
export type AgentAbortedEvent = AgentAbortedEventPayload & {
	timestamp: number;
};

export type AgentEventPayload =
	| AgentStartEventPayload
	| AgentThinkingEventPayload
	| AgentThinkingDeltaEventPayload
	| AgentTextEventPayload
	| AgentTextDeltaEventPayload
	| AgentToolEventPayload
	| AgentErrorEventPayload
	| AgentCompleteEventPayload
	| AgentPausedEventPayload
	| AgentAbortedEventPayload;

/**
 * Events emitted by the runtime for observability and UI rendering.
 */
export type RuntimeEventPayload =
	| { type: "flow:start"; flowName: string }
	| { type: "flow:complete"; flowName: string; status: "complete" | "failed" }
	| { type: "node:start"; nodeId: string; runId: string }
	| { type: "node:complete"; nodeId: string; runId: string; output: unknown }
	| { type: "node:error"; nodeId: string; runId: string; error: string }
	| { type: "node:skipped"; nodeId: string; reason: "edge" | "when" }
	| { type: "edge:fire"; edgeId?: string; from: string; to: string }
	| { type: "loop:iterate"; edgeId?: string; iteration: number }
	| { type: "state:patch"; patch: StatePatch }
	| { type: "command:received"; command: RuntimeCommand }
	| { type: "flow:paused" | "flow:resumed" | "flow:aborted" }
	| AgentEventPayload;

export type RuntimeEvent = RuntimeEventPayload & { timestamp: number };

export type AgentEvent =
	| AgentStartEvent
	| AgentThinkingEvent
	| AgentThinkingDeltaEvent
	| AgentTextEvent
	| AgentTextDeltaEvent
	| AgentToolEvent
	| AgentErrorEvent
	| AgentCompleteEvent
	| AgentPausedEvent
	| AgentAbortedEvent;

/** Callback invoked for each emitted runtime event. */
export type RuntimeEventListener = (
	/** Event payload. */
	event: RuntimeEvent,
) => void | Promise<void>;

/** Unsubscribe function returned by event subscriptions. */
export type Unsubscribe = () => void;
