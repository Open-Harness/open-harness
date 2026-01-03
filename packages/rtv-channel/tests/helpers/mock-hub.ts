import type {
	BaseEvent,
	EnrichedEvent,
	EventContext,
	EventFilter,
	EventListener,
	Hub,
	UserResponse,
} from "../../src/channel/types";

type ListenerEntry = {
	filter: EventFilter;
	listener: EventListener;
};

const matchFilter = (filter: EventFilter, type: string): boolean => {
	if (filter === "*") return true;
	if (Array.isArray(filter)) return filter.some((f) => matchFilter(f, type));
	if (filter.endsWith("*")) return type.startsWith(filter.slice(0, -1));
	return filter === type;
};

export class MockHub implements Hub {
	private listeners: ListenerEntry[] = [];
	private context: EventContext = { sessionId: "test-session" };
	readonly status = "idle";
	readonly sessionActive = true;
	readonly events: EnrichedEvent[] = [];

	[Symbol.asyncIterator](): AsyncIterator<EnrichedEvent> {
		let index = 0;
		return {
			next: async () => {
				while (index >= this.events.length) {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
				return { value: this.events[index++], done: false };
			},
		};
	}

	subscribe(listener: EventListener): () => void;
	subscribe(filter: EventFilter, listener: EventListener): () => void;
	subscribe(
		filterOrListener: EventFilter | EventListener,
		listener?: EventListener,
	): () => void {
		const entry: ListenerEntry =
			typeof filterOrListener === "function"
				? { filter: "*", listener: filterOrListener }
				: { filter: filterOrListener, listener: listener as EventListener };
		this.listeners.push(entry);
		return () => {
			this.listeners = this.listeners.filter((l) => l !== entry);
		};
	}

	emit(event: BaseEvent, override?: Partial<EventContext>): void {
		const enriched: EnrichedEvent = {
			id: `evt-${Date.now()}-${Math.random()}`,
			timestamp: new Date(),
			context: { ...this.context, ...override },
			event,
		};
		this.events.push(enriched);
		for (const entry of this.listeners) {
			if (matchFilter(entry.filter, event.type)) {
				void entry.listener(enriched);
			}
		}
	}

	scoped<T>(
		context: Partial<EventContext>,
		fn: () => T | Promise<T>,
	): T | Promise<T> {
		const prev = this.context;
		this.context = { ...this.context, ...context };
		const result = fn();
		return result instanceof Promise
			? result.finally(() => {
					this.context = prev;
				})
			: ((this.context = prev), result);
	}

	current(): EventContext {
		return { ...this.context };
	}

	send(): void {}
	sendTo(): void {}
	sendToRun(): void {}
	reply(_promptId: string, _response: UserResponse): void {}
	abort(): void {}
}
