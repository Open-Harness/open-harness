// Engine: Hub
// Implements docs/spec/hub.md

import { AsyncLocalStorage } from "node:async_hooks";
import type {
	BaseEvent,
	EventContext,
	EventFilter,
	EventListener,
	EnrichedEvent,
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

	constructor(private readonly sessionId: string) {}

	get status(): HubStatus {
		return this._status;
	}

	get sessionActive(): boolean {
		return this._sessionActive;
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
			actualListener = listener!;
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

	scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T> {
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
					yield queue.shift()!;
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
