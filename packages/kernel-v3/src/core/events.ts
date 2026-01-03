import type { ClaudeMessageInput } from "../nodes/claude.agent.js";
import type { StatePatch } from "./state.js";

/** Runtime lifecycle status for a flow execution. */
export type RuntimeStatus = "idle" | "running" | "paused" | "aborted" | "complete";

/**
 * Commands ingested by the runtime (from UI, CLI, or other adapters).
 *
 * Variants:
 * - send: deliver a message (optionally to a specific run)
 * - reply: answer a prompt
 * - abort: stop execution (optionally resumable)
 * - resume: resume a paused run with a message
 */
export type RuntimeCommand =
	| { type: "send"; message: string; runId: string }
	| { type: "reply"; promptId: string; content: string; runId: string }
	| { type: "abort"; resumable?: boolean; reason?: string }
	| { type: "resume"; message?: string };

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

export type AgentTextEventPayload = {
	type: "agent:text";
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

export type AgentStartEvent = AgentStartEventPayload & { timestamp: number };
export type AgentThinkingEvent = AgentThinkingEventPayload & {
	timestamp: number;
};
export type AgentTextEvent = AgentTextEventPayload & { timestamp: number };
export type AgentToolEvent = AgentToolEventPayload & { timestamp: number };
export type AgentErrorEvent = AgentErrorEventPayload & { timestamp: number };
export type AgentCompleteEvent = AgentCompleteEventPayload & {
	timestamp: number;
};

export type AgentEventPayload =
	| AgentStartEventPayload
	| AgentThinkingEventPayload
	| AgentTextEventPayload
	| AgentToolEventPayload
	| AgentErrorEventPayload
	| AgentCompleteEventPayload;

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
	| AgentTextEvent
	| AgentToolEvent
	| AgentErrorEvent
	| AgentCompleteEvent;

/** Callback invoked for each emitted runtime event. */
export type RuntimeEventListener = (
	/** Event payload. */
	event: RuntimeEvent,
) => void | Promise<void>;

/** Unsubscribe function returned by event subscriptions. */
export type Unsubscribe = () => void;
