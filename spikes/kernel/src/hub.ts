import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { BaseEvent, EnrichedEvent, EventContext, EventFilter, EventListener, Unsubscribe } from "./events.js";
import { matchesFilter } from "./filter.js";

export type HubStatus = "idle" | "running" | "complete" | "aborted";

export interface UserResponse {
	/** Free-text response (may be equal to choice when choice-only UI is used) */
	content: string;
	/** Selected choice (optional) */
	choice?: string;
	/** Timestamp set by the replying channel */
	timestamp: Date;
}

export interface Hub extends AsyncIterable<EnrichedEvent> {
	// Events out
	subscribe(listener: EventListener): Unsubscribe;
	subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;
	emit(event: BaseEvent, override?: Partial<EventContext>): void;
	scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T>;
	current(): EventContext;

	// Commands in (bidirectional)
	send(message: string): void;
	sendTo(agent: string, message: string): void;
	/**
	 * Correct (run-scoped) injection when multiple agent runs may be active.
	 * The runId is provided by `agent:start` / `agent:complete` events.
	 */
	sendToRun(runId: string, message: string): void;
	reply(promptId: string, response: UserResponse): void;
	abort(reason?: string): void;

	// Status
	readonly status: HubStatus;
	readonly sessionActive: boolean;
}

type ListenerEntry = { filter: EventFilter; listener: EventListener };

/**
 * Minimal ALS-powered hub.
 *
 * - Provides automatic context propagation via AsyncLocalStorage
 * - Provides filtered subscriptions
 * - Provides async-iteration (firehose)
 *
 * NOTE: command methods are no-ops here; HarnessHub extends this to implement session behavior.
 */
export class BaseHub implements Hub {
	private readonly als = new AsyncLocalStorage<EventContext>();
	private readonly listeners: ListenerEntry[] = [];
	private readonly iterQueues = new Set<AsyncQueue<EnrichedEvent>>();

	protected _status: HubStatus = "idle";
	protected _sessionActive = false;
	protected readonly sessionId: string;

	constructor(sessionId: string = randomUUID()) {
		this.sessionId = sessionId;
	}

	get status(): HubStatus {
		return this._status;
	}

	get sessionActive(): boolean {
		return this._sessionActive;
	}

	current(): EventContext {
		return this.als.getStore() ?? { sessionId: this.sessionId };
	}

	scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T> {
		const base = this.current();
		const merged: EventContext = {
			...base,
			...context,
			phase: context.phase ?? base.phase,
			task: context.task ?? base.task,
			agent: context.agent ?? base.agent,
		};
		return this.als.run(merged, fn);
	}

	subscribe(listener: EventListener): Unsubscribe;
	subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;
	subscribe(filterOrListener: EventFilter | EventListener, maybeListener?: EventListener): Unsubscribe {
		const filter: EventFilter = typeof filterOrListener === "function" ? "*" : filterOrListener;
		const listener: EventListener =
			typeof filterOrListener === "function" ? filterOrListener : (maybeListener as EventListener);

		const entry: ListenerEntry = { filter, listener };
		this.listeners.push(entry);
		return () => {
			const idx = this.listeners.indexOf(entry);
			if (idx >= 0) this.listeners.splice(idx, 1);
		};
	}

	emit(event: BaseEvent, override?: Partial<EventContext>): void {
		if (this._status === "complete") return;

		const inherited = this.current();
		const context: EventContext = {
			...inherited,
			...override,
			sessionId: inherited.sessionId,
			phase: override?.phase ?? inherited.phase,
			task: override?.task ?? inherited.task,
			agent: override?.agent ?? inherited.agent,
		};

		const enriched: EnrichedEvent = {
			id: randomUUID(),
			timestamp: new Date(),
			context,
			event,
		};

		// async-iter consumers
		for (const q of this.iterQueues) q.push(enriched);

		// subscribers
		for (const { filter, listener } of this.listeners) {
			if (!matchesFilter(event.type, filter)) continue;
			try {
				void listener(enriched);
			} catch {
				// non-fatal
			}
		}
	}

	// Commands (default no-ops; implemented in harness)
	send(_message: string): void {}
	sendTo(_agent: string, _message: string): void {}
	sendToRun(_runId: string, _message: string): void {}
	reply(_promptId: string, _response: UserResponse): void {}
	abort(_reason?: string): void {}

	[Symbol.asyncIterator](): AsyncIterator<EnrichedEvent> {
		const q = new AsyncQueue<EnrichedEvent>();
		this.iterQueues.add(q);

		return {
			next: async () => {
				const value = await q.pop();
				if (value === undefined) {
					return { done: true, value: undefined };
				}
				return { done: false, value };
			},
			return: async () => {
				q.close();
				this.iterQueues.delete(q);
				return { done: true, value: undefined };
			},
		};
	}
}

class AsyncQueue<T> {
	private items: T[] = [];
	private waiters: Array<(v: T | undefined) => void> = [];
	private closed = false;

	push(item: T): void {
		if (this.closed) return;
		const waiter = this.waiters.shift();
		if (waiter) waiter(item);
		else this.items.push(item);
	}

	async pop(): Promise<T | undefined> {
		if (this.items.length > 0) return this.items.shift();
		if (this.closed) return undefined;
		return await new Promise<T | undefined>((resolve) => this.waiters.push(resolve));
	}

	close(): void {
		this.closed = true;
		for (const w of this.waiters) w(undefined);
		this.waiters = [];
	}
}
