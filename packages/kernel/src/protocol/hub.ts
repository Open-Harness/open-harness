// Protocol: Hub
// See docs/reference/protocol-types.md for authoritative definitions

import type { ChannelDefinition } from "./channel.js";
import type {
	BaseEvent,
	EnrichedEvent,
	EventContext,
	EventFilter,
	EventListener,
	Unsubscribe,
} from "./events.js";

export type HubStatus = "idle" | "running" | "paused" | "complete" | "aborted";

/**
 * Options for the abort operation.
 * If resumable is true, flow will pause (status: "paused") instead of terminating.
 * If resumable is false or omitted, flow terminates permanently (status: "aborted").
 */
export interface PauseOptions {
	resumable?: boolean;
	reason?: string;
}

export interface UserResponse {
	content: string;
	choice?: string;
	timestamp: Date;
}

export interface Hub extends AsyncIterable<EnrichedEvent> {
	// Events out
	subscribe(listener: EventListener): Unsubscribe;
	subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;
	emit(event: BaseEvent, override?: Partial<EventContext>): void;
	scoped<T>(
		context: Partial<EventContext>,
		fn: () => T | Promise<T>,
	): T | Promise<T>;
	current(): EventContext;

	// Commands in (bidirectional)
	send(message: string): void;
	sendTo(agent: string, message: string): void;
	sendToRun(runId: string, message: string): void;
	reply(promptId: string, response: UserResponse): void;
	abort(options?: PauseOptions): void;

	// Pause/Resume operations
	getAbortSignal(): AbortSignal;
	resume(sessionId: string, message: string): Promise<void>;
	getPausedSession(
		sessionId: string,
	): import("./flow-runtime.js").SessionState | undefined;

	/**
	 * Called by executor to update paused session state with actual runtime values.
	 * This bridges the gap between Hub (state storage) and Executor (runtime knowledge).
	 */
	updatePausedState(
		nodeIndex: number,
		outputs: Record<string, unknown>,
		currentNodeId: string,
		flowName?: string,
	): void;

	/**
	 * Called by executor on startup to check if it should resume from a paused state.
	 * Returns the SessionState if resumption is needed, undefined otherwise.
	 */
	getResumptionState(): import("./flow-runtime.js").SessionState | undefined;

	/**
	 * Called by executor/hub when flow completes successfully to clean up paused state.
	 */
	clearPausedSession(sessionId: string): void;

	// Channel management
	registerChannel<TState>(channel: ChannelDefinition<TState>): this;
	unregisterChannel(name: string): boolean;

	// Lifecycle
	start(): Promise<void>;
	stop(): Promise<void>;
	startSession(): void;
	setStatus(status: HubStatus): void;

	// Status
	readonly status: HubStatus;
	readonly sessionActive: boolean;
	readonly channels: ReadonlyArray<string>;
}
