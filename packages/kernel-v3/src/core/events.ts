import type { StatePatch } from "./state.js";

/** Runtime lifecycle status for a flow execution. */
export type RuntimeStatus =
	| "idle"
	| "running"
	| "paused"
	| "aborted"
	| "complete";

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
	| { type: "send"; message: string; runId?: string }
	| { type: "reply"; promptId: string; content: string }
	| { type: "abort"; resumable?: boolean; reason?: string }
	| { type: "resume"; message: string };

/**
 * Events emitted by the runtime for observability and UI rendering.
 */
export type RuntimeEvent =
	| { type: "flow:start"; flowName: string }
	| { type: "flow:complete"; flowName: string; status: "complete" | "failed" }
	| { type: "node:start"; nodeId: string; runId: string }
	| { type: "node:complete"; nodeId: string; runId: string; output: unknown }
	| { type: "node:error"; nodeId: string; runId: string; error: string }
	| { type: "edge:fire"; edgeId?: string; from: string; to: string }
	| { type: "loop:iterate"; edgeId?: string; iteration: number }
	| { type: "state:patch"; patch: StatePatch }
	| { type: "command:received"; command: RuntimeCommand }
	| { type: "flow:paused" | "flow:resumed" | "flow:aborted" };

/** Callback invoked for each emitted runtime event. */
export type RuntimeEventListener = (
	/** Event payload. */
	event: RuntimeEvent,
) => void | Promise<void>;

/** Unsubscribe function returned by event subscriptions. */
export type Unsubscribe = () => void;
