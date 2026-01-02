// Engine: Hub
// Implements docs/spec/hub.md

import { AsyncLocalStorage } from "node:async_hooks";
import type {
	ChannelDefinition,
	ChannelInstance,
} from "../protocol/channel.js";
import {
	SessionAlreadyRunningError,
	SessionNotFoundError,
} from "../protocol/errors.js";
import type {
	BaseEvent,
	EnrichedEvent,
	EventContext,
	EventFilter,
	EventListener,
} from "../protocol/events.js";
import type { SessionState } from "../protocol/flow-runtime.js";
import type {
	Hub,
	HubStatus,
	PauseOptions,
	UserResponse,
} from "../protocol/hub.js";
import type { SessionContext } from "../protocol/session.js";
import { createSessionContext } from "../protocol/session.js";
import { createEnrichedEvent, matchesFilter } from "./events.js";

type ListenerEntry = { filter: EventFilter; listener: EventListener };

/**
 * Minimal Hub implementation with AsyncLocalStorage context propagation.
 */
export class HubImpl implements Hub {
	private readonly listeners: ListenerEntry[] = [];
	private readonly _context = new AsyncLocalStorage<EventContext>();
	private _status: HubStatus = "idle";
	private _sessionActive = false;

	// Channel registry
	// biome-ignore lint/suspicious/noExplicitAny: Generic channel storage requires any
	private readonly _channels = new Map<string, ChannelInstance<any>>();
	private _started = false;

	// Session context for abort signal propagation (T009)
	private _sessionContext: SessionContext;

	// Storage for paused session states (T010)
	private readonly _pausedSessions = new Map<string, SessionState>();

	constructor(private readonly sessionId: string) {
		// Initialize session context with abort controller
		this._sessionContext = createSessionContext();
	}

	get status(): HubStatus {
		return this._status;
	}

	get sessionActive(): boolean {
		return this._sessionActive;
	}

	get channels(): ReadonlyArray<string> {
		return Array.from(this._channels.keys());
	}

	/**
	 * Returns the current session's abort signal for cooperative cancellation.
	 * Executor and agent nodes use this to check for pause/abort requests.
	 */
	getAbortSignal(): AbortSignal {
		return this._sessionContext.abortController.signal;
	}

	subscribe(listener: EventListener): () => void;
	subscribe(filter: EventFilter, listener: EventListener): () => void;
	subscribe(
		filterOrListener: EventFilter | EventListener,
		listener?: EventListener,
	): () => void {
		let filter: EventFilter;
		let actualListener: EventListener;

		if (typeof filterOrListener === "function") {
			filter = "*";
			actualListener = filterOrListener;
		} else {
			filter = filterOrListener;
			if (!listener) {
				throw new Error("Listener is required when filter is provided");
			}
			actualListener = listener;
		}

		const entry: ListenerEntry = { filter, listener: actualListener };
		this.listeners.push(entry);

		return () => {
			const index = this.listeners.indexOf(entry);
			if (index >= 0) {
				this.listeners.splice(index, 1);
			}
		};
	}

	emit(event: BaseEvent, override?: Partial<EventContext>): void {
		const context = this.current();
		const enriched = createEnrichedEvent(event, context, override);

		// Notify all matching listeners
		for (const { filter, listener } of this.listeners) {
			if (matchesFilter(event.type, filter)) {
				try {
					void listener(enriched);
				} catch (error) {
					// Non-fatal: log but don't break emission
					console.error("Listener error:", error);
				}
			}
		}
	}

	scoped<T>(
		context: Partial<EventContext>,
		fn: () => T | Promise<T>,
	): T | Promise<T> {
		const current = this.current();
		const merged = { ...current, ...context };
		return this._context.run(merged, fn);
	}

	current(): EventContext {
		return this._context.getStore() ?? { sessionId: this.sessionId };
	}

	send(message: string): void {
		if (!this._sessionActive) return;
		this.emit({
			type: "session:message",
			content: message,
		});
	}

	sendTo(agent: string, message: string): void {
		if (!this._sessionActive) return;
		this.emit({
			type: "session:message",
			content: message,
			agentName: agent,
		});
	}

	sendToRun(runId: string, message: string): void {
		if (!this._sessionActive) return;
		this.emit({
			type: "session:message",
			content: message,
			runId,
		});
	}

	reply(promptId: string, response: UserResponse): void {
		if (!this._sessionActive) return;
		this.emit({
			type: "session:reply",
			promptId,
			content: response.content,
			choice: response.choice,
		});
	}

	abort(options?: PauseOptions): void {
		if (!this._sessionActive) return;

		if (options?.resumable) {
			// T018: Resumable pause - set status to "paused" and emit flow:paused
			this._status = "paused";

			// T026: Capture SessionState on pause
			const sessionState: SessionState = {
				sessionId: this.sessionId,
				flowName: "flow", // Will be set by executor in Phase 4+
				currentNodeId: this.current().task?.id ?? "unknown",
				currentNodeIndex: 0, // Will be set by executor in T030
				outputs: {}, // Will be set by executor in T030
				pendingMessages: [],
				pausedAt: new Date(),
				pauseReason: options.reason,
			};
			this._pausedSessions.set(this.sessionId, sessionState);

			this.emit({
				type: "flow:paused",
				sessionId: this.sessionId,
				nodeId: sessionState.currentNodeId,
				reason: options.reason,
			});
		} else {
			// T047/T050: Terminal abort - clear any paused session and transition to "aborted"
			this._pausedSessions.delete(this.sessionId);
			this._status = "aborted";
			this.emit({
				type: "session:abort",
				reason: options?.reason,
			});
		}

		// T019: Trigger abort signal for cooperative cancellation
		this._sessionContext.abortController.abort();
	}

	async resume(sessionId: string, message: string): Promise<void> {
		// T032: Validate message is non-empty
		if (!message || message.trim() === "") {
			throw new Error("Message is required for resume");
		}

		// T025: Check if already running
		if (this._status === "running") {
			throw new SessionAlreadyRunningError(sessionId);
		}

		// T024/T027: Validate sessionId exists in paused sessions
		const state = this._pausedSessions.get(sessionId);
		if (!state) {
			throw new SessionNotFoundError(sessionId);
		}

		// T035: Queue the injected message (US3 preparation)
		state.pendingMessages.push(message);

		// T028: Create new SessionContext for resumed execution
		this._sessionContext = createSessionContext();

		// T029: Set status to "running" and emit flow:resumed event
		this._status = "running";

		// T036: Deliver message via session:message pattern before resuming
		this.emit({
			type: "session:message",
			content: message,
		});

		this.emit({
			type: "flow:resumed",
			sessionId: state.sessionId,
			nodeId: state.currentNodeId,
			injectedMessages: state.pendingMessages.length,
		});

		// Note: Actual resumption of executor happens externally via T030
		// The executor will coordinate with Hub to restore state
	}

	// T041: Get paused session state for inspection
	getPausedSession(sessionId: string): SessionState | undefined {
		return this._pausedSessions.get(sessionId);
	}

	// T030: Bridge method for executor to update paused state with actual runtime values
	updatePausedState(
		nodeIndex: number,
		outputs: Record<string, unknown>,
		currentNodeId: string,
		flowName?: string,
	): void {
		const state = this._pausedSessions.get(this.sessionId);
		if (state) {
			state.currentNodeIndex = nodeIndex;
			state.outputs = outputs;
			state.currentNodeId = currentNodeId;
			if (flowName) {
				state.flowName = flowName;
			}
		}
	}

	// T030: Get resumption state for executor to check on startup
	getResumptionState(): SessionState | undefined {
		// Return state if hub is in "running" state after resume() was called
		// The status was set to "running" by resume(), indicating resumption is needed
		if (this._status === "running") {
			return this._pausedSessions.get(this.sessionId);
		}
		return undefined;
	}

	// T031: Clear paused session on completion
	clearPausedSession(sessionId: string): void {
		this._pausedSessions.delete(sessionId);
	}

	startSession(): void {
		this._sessionActive = true;
	}

	setStatus(status: HubStatus): void {
		this._status = status;
	}

	// Channel management

	registerChannel<TState>(channel: ChannelDefinition<TState>): this {
		// Validate
		if (!channel.name || typeof channel.name !== "string") {
			throw new Error("Channel must have a valid name");
		}
		if (this._channels.has(channel.name)) {
			throw new Error(`Channel "${channel.name}" is already registered`);
		}

		// Initialize state
		const state = channel.state ? channel.state() : ({} as TState);

		// Create instance
		const instance: ChannelInstance<TState> = {
			definition: channel,
			state,
			subscriptions: [],
			started: false,
		};

		this._channels.set(channel.name, instance);
		this.emit({ type: "channel:registered", name: channel.name });

		// Late registration: start immediately if hub already started
		if (this._started) {
			void this._startChannel(instance);
		}

		return this;
	}

	unregisterChannel(name: string): boolean {
		const instance = this._channels.get(name);
		if (!instance) return false;

		if (instance.started) {
			void this._stopChannel(instance);
		}

		this._channels.delete(name);
		this.emit({ type: "channel:unregistered", name });
		return true;
	}

	async start(): Promise<void> {
		if (this._started) return; // Idempotent
		this._started = true;

		const startPromises = Array.from(this._channels.values()).map((instance) =>
			this._startChannel(instance),
		);

		await Promise.allSettled(startPromises);
	}

	async stop(): Promise<void> {
		if (!this._started) return; // Idempotent

		const stopPromises = Array.from(this._channels.values()).map((instance) =>
			this._stopChannel(instance),
		);

		await Promise.allSettled(stopPromises);
		this._started = false;
	}

	private async _startChannel<TState>(
		instance: ChannelInstance<TState>,
	): Promise<void> {
		if (instance.started) return;

		const { definition, state } = instance;
		const emit = (event: BaseEvent) => this.emit(event);

		try {
			// Subscribe to each pattern
			for (const [pattern, handler] of Object.entries(definition.on)) {
				const unsubscribe = this.subscribe(pattern, async (event) => {
					try {
						await handler({ hub: this, state, event, emit });
					} catch (err) {
						console.error(`Channel "${definition.name}" handler error:`, err);
						this.emit({
							type: "channel:error",
							name: definition.name,
							error: String(err),
						});
					}
				});
				instance.subscriptions.push(unsubscribe);
			}

			// Call onStart
			if (definition.onStart) {
				await definition.onStart({ hub: this, state, emit });
			}

			instance.started = true;
			this.emit({ type: "channel:started", name: definition.name });
		} catch (err) {
			// Cleanup on failure
			for (const unsub of instance.subscriptions) unsub();
			instance.subscriptions = [];

			console.error(`Channel "${definition.name}" failed to start:`, err);
			this.emit({
				type: "channel:error",
				name: definition.name,
				error: String(err),
			});
			throw err;
		}
	}

	private async _stopChannel<TState>(
		instance: ChannelInstance<TState>,
	): Promise<void> {
		if (!instance.started) return;

		const { definition, state } = instance;
		const emit = (event: BaseEvent) => this.emit(event);

		try {
			if (definition.onComplete) {
				await definition.onComplete({ hub: this, state, emit });
			}
		} catch (err) {
			console.error(`Channel "${definition.name}" onComplete error:`, err);
		}

		// Unsubscribe all
		for (const unsub of instance.subscriptions) {
			try {
				unsub();
			} catch {
				// Ignore unsubscribe errors
			}
		}
		instance.subscriptions = [];
		instance.started = false;

		this.emit({ type: "channel:stopped", name: definition.name });
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<EnrichedEvent> {
		const queue: EnrichedEvent[] = [];
		let resolve: ((value: EnrichedEvent) => void) | null = null;

		const unsubscribe = this.subscribe("*", (event: EnrichedEvent) => {
			if (resolve) {
				resolve(event);
				resolve = null;
			} else {
				queue.push(event);
			}
		});

		try {
			while (true) {
				if (queue.length > 0) {
					const event = queue.shift();
					if (event) {
						yield event;
					}
				} else {
					yield await new Promise<EnrichedEvent>((res) => {
						resolve = res;
					});
				}
			}
		} finally {
			unsubscribe();
		}
	}
}

/**
 * Creates a new Hub instance.
 */
export function createHub(sessionId: string = `session-${Date.now()}`): Hub {
	return new HubImpl(sessionId);
}
