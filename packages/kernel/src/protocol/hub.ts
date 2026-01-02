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

export type HubStatus = "idle" | "running" | "complete" | "aborted";

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
	abort(reason?: string): void;

	// Channel management
	registerChannel<TState>(channel: ChannelDefinition<TState>): this;
	unregisterChannel(name: string): boolean;

	// Lifecycle
	start(): Promise<void>;
	stop(): Promise<void>;

	// Status
	readonly status: HubStatus;
	readonly sessionActive: boolean;
	readonly channels: ReadonlyArray<string>;
}
