// Hub protocol types (mirroring kernel protocol)
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

// Configuration
export type GithubChannelConfig = {
	repo: string;
	issueNumber?: number;
	prNumber?: number;
	tokenEnv: string;
	mentions?: string[];
	debounceMs?: number; // default 3000
	maxRecent?: number; // default 50
	allowCommands?: string[];
	pollIntervalMs?: number; // default 5000, set 0 to disable polling
	logLevel?: string; // pino log level
};

// State (curated)
export type GithubChannelState = {
	run: {
		id: string | null;
		status: "idle" | "running" | "paused" | "complete" | "aborted";
	};
	phase: {
		name: string | null;
		number?: number;
		status: "idle" | "running" | "complete" | "failed";
	};
	tasks: Array<{
		id: string;
		label?: string;
		state: "pending" | "running" | "done" | "failed";
		summary?: string;
	}>;
	agents: Array<{
		name: string;
		runId?: string;
		status?: string;
		last?: string;
	}>;
	prompts: Array<{
		promptId: string;
		prompt: string;
		choices?: string[];
		allowText?: boolean;
		status: "open" | "answered";
		from?: string;
	}>;
	recent: Array<{
		ts: string;
		type: string;
		text?: string;
	}>;
	errors: Array<{
		ts: string;
		message: string;
	}>;
	summary?: string; // rolling abstract when recent overflows
	updatedAt: string;
};
