export type BaseEvent = { type: string; [k: string]: unknown };

export type EventContext = {
	sessionId?: string;
	phase?: { name: string; number?: number };
	task?: { id: string };
	agent?: { name: string; type?: string };
	[k: string]: unknown;
};

export type EnrichedEvent<T extends BaseEvent = BaseEvent> = {
	id: string;
	timestamp: Date;
	context: EventContext;
	event: T;
};

export type EventFilter = "*" | string | string[];
export type EventListener<T extends BaseEvent = BaseEvent> = (
	event: EnrichedEvent<T>,
) => void | Promise<void>;
export type Unsubscribe = () => void;

export type HubStatus = "idle" | "running" | "complete" | "aborted";

export interface UserResponse {
	content: string;
	choice?: string;
	timestamp: Date;
}

export interface Hub extends AsyncIterable<EnrichedEvent> {
	subscribe(listener: EventListener): Unsubscribe;
	subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;
	emit(event: BaseEvent, override?: Partial<EventContext>): void;
	scoped<T>(
		context: Partial<EventContext>,
		fn: () => T | Promise<T>,
	): T | Promise<T>;
	current(): EventContext;

	send(message: string): void;
	sendTo(agent: string, message: string): void;
	sendToRun(runId: string, message: string): void;
	reply(promptId: string, response: UserResponse): void;
	abort(reason?: string): void;

	readonly status: HubStatus;
	readonly sessionActive: boolean;
}

export type Cleanup = void | (() => void) | (() => Promise<void>);
export type Attachment = (hub: Hub) => Cleanup;

export interface ChannelDefinition<TState> {
	name: string;
	state?: () => TState;
	onStart?: (ctx: {
		hub: Hub;
		state: TState;
		emit: (event: BaseEvent) => void;
	}) => void | Promise<void>;
	onComplete?: (ctx: {
		hub: Hub;
		state: TState;
		emit: (event: BaseEvent) => void;
	}) => void | Promise<void>;
	on: Record<
		string,
		(ctx: {
			hub: Hub;
			state: TState;
			event: EnrichedEvent<BaseEvent>;
			emit: (event: BaseEvent) => void;
		}) => void | Promise<void>
	>;
}
