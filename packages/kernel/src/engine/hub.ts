// Engine: Hub
// Implements docs/spec/hub.md

import { AsyncLocalStorage } from "node:async_hooks";
import type {
	ChannelDefinition,
	ChannelInstance,
} from "../protocol/channel.js";
import type {
	BaseEvent,
	EnrichedEvent,
	EventContext,
	EventFilter,
	EventListener,
} from "../protocol/events.js";
import type { Hub, HubStatus, UserResponse } from "../protocol/hub.js";
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

	constructor(private readonly sessionId: string) {}

	get status(): HubStatus {
		return this._status;
	}

	get sessionActive(): boolean {
		return this._sessionActive;
	}

	get channels(): ReadonlyArray<string> {
		return Array.from(this._channels.keys());
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

	abort(reason?: string): void {
		if (!this._sessionActive) return;
		this._status = "aborted";
		this.emit({
			type: "session:abort",
			reason,
		});
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
