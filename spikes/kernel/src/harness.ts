import { randomUUID } from "node:crypto";
import type { AgentDefinition, AgentInbox, ExecutableAgent, InjectedMessage } from "./agent.js";
import type { BaseEvent, EnrichedEvent } from "./events.js";
import { BaseHub, type Hub, type HubStatus, type UserResponse } from "./hub.js";

export type Cleanup = void | (() => void) | (() => Promise<void>);
export type Attachment = (hub: Hub) => Cleanup;

export interface SessionContext {
	waitForUser(prompt: string, options?: { choices?: string[]; allowText?: boolean }): Promise<UserResponse>;
	hasMessages(): boolean;
	readMessages(): Array<{ content: string; agent?: string; timestamp: Date }>;
	isAborted(): boolean;
}

export type ExecutableAgents<T extends Record<string, AgentDefinition>> = {
	[K in keyof T]: T[K] extends AgentDefinition<infer TIn, infer TOut> ? ExecutableAgent<TIn, TOut> : never;
};

export interface ExecuteContext<TAgentDefs extends Record<string, AgentDefinition>, TState> {
	agents: ExecutableAgents<TAgentDefs>;
	state: TState;
	hub: Hub;

	phase: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
	task: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
	emit: (event: BaseEvent) => void;

	// Present only when startSession() called
	session?: SessionContext;
}

export interface HarnessResult<TState, TResult> {
	result: TResult;
	state: TState;
	events: EnrichedEvent[];
	durationMs: number;
	status: HubStatus;
}

export interface HarnessInstance<TState, TResult> extends Hub {
	readonly state: TState;
	attach(attachment: Attachment): this;
	startSession(): this;
	run(): Promise<HarnessResult<TState, TResult>>;
}

export interface HarnessFactory<TInput, TState, TResult> {
	create(input: TInput): HarnessInstance<TState, TResult>;
}

export interface HarnessConfig<TInput, TAgentDefs extends Record<string, AgentDefinition>, TState, TResult> {
	name: string;
	agents: TAgentDefs;
	state: (input: TInput) => TState;
	run: (ctx: ExecuteContext<TAgentDefs, TState>, input: TInput) => Promise<TResult>;
}

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e?: unknown) => void };

function deferred<T>(): Deferred<T> {
	let resolve!: (v: T) => void;
	let reject!: (e?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

class HarnessHub<TState, TResult> extends BaseHub implements HarnessInstance<TState, TResult> {
	readonly state: TState;
	private readonly name: string;
	private readonly attachments: Attachment[] = [];
	private readonly recorded: EnrichedEvent[] = [];

	private readonly promptWaiters = new Map<string, Deferred<UserResponse>>();
	private readonly injectedMessages: Array<{ content: string; agent?: string; timestamp: Date }> = [];
	private aborted = false;
	private promptCounter = 0;

	private readonly agentMailboxes = new Map<string, AgentMailbox>();
	private readonly runMailboxes = new Map<string, AgentMailbox>();
	private readonly activeRunsByAgent = new Map<string, Set<string>>();
	private readonly queuedByAgent = new Map<string, Array<{ content: string; timestamp: Date }>>();

	private _runUserCode!: () => Promise<TResult>;

	constructor(args: { name: string; state: TState; sessionId: string }) {
		super(args.sessionId);
		this.name = args.name;
		this.state = args.state;
		this.subscribe("*", (e) => {
			this.recorded.push(e);
		});
	}

	attach(attachment: Attachment): this {
		if (this._status !== "idle") throw new Error("Cannot attach after run started");
		this.attachments.push(attachment);
		return this;
	}

	startSession(): this {
		if (this._status !== "idle") throw new Error("Cannot start session after run started");
		this._sessionActive = true;
		return this;
	}

	send(message: string): void {
		if (!this._sessionActive) return;
		this.injectedMessages.push({ content: message, timestamp: new Date() });
		this.emit({ type: "session:message", content: message });
	}

	sendTo(agent: string, message: string): void {
		if (!this._sessionActive) return;
		this.injectedMessages.push({ content: message, agent, timestamp: new Date() });
		this.emit({ type: "session:message", content: message, agentName: agent });

		const runIds = this.activeRunsByAgent.get(agent);
		if (runIds && runIds.size === 1) {
			const only = [...runIds][0];
			if (!only) {
				throw new Error(`Invariant violation: sendTo("${agent}") had size=1 but no runId.`);
			}
			this.sendToRun(only, message);
			return;
		}

		if (runIds && runIds.size > 1) {
			// Correctness: refuse ambiguous delivery.
			throw new Error(`Ambiguous sendTo("${agent}"): ${runIds.size} active runs. Use sendToRun(runId, msg).`);
		}

		// No active run: queue for next run of that agent.
		const q = this.queuedByAgent.get(agent) ?? [];
		q.push({ content: message, timestamp: new Date() });
		this.queuedByAgent.set(agent, q);
	}

	sendToRun(runId: string, message: string): void {
		if (!this._sessionActive) return;
		this.emit({ type: "session:message", content: message, runId });

		const mailbox = this.runMailboxes.get(runId);
		if (!mailbox) {
			throw new Error(`sendToRun("${runId}") failed: runId not active (or already completed).`);
		}
		mailbox.push({ content: message, timestamp: new Date() });
	}

	reply(promptId: string, response: UserResponse): void {
		if (!this._sessionActive) return;
		const d = this.promptWaiters.get(promptId);
		if (!d) return; // first-reply-wins
		this.promptWaiters.delete(promptId);
		// Fallback behavior: if a channel sends choice-only, treat content=choice
		const normalized: UserResponse = {
			content: response.content?.length ? response.content : (response.choice ?? ""),
			choice: response.choice,
			timestamp: response.timestamp ?? new Date(),
		};

		d.resolve(normalized);
		this.emit({ type: "session:reply", promptId, content: normalized.content, choice: normalized.choice });
	}

	abort(reason?: string): void {
		if (!this._sessionActive) return;
		if (this.aborted) return;
		this.aborted = true;
		this._status = "aborted";
		this.emit({ type: "session:abort", reason });
		for (const d of this.promptWaiters.values()) d.reject(new Error(reason ?? "Aborted"));
		this.promptWaiters.clear();
	}

	createSessionContext(): SessionContext {
		return {
			waitForUser: async (prompt, options) => {
				if (!this._sessionActive) throw new Error("Session mode not active");
				if (this.aborted) throw new Error("Aborted");
				const promptId = `prompt-${++this.promptCounter}`;
				// IMPORTANT: register waiter before emitting, to avoid “fast reply” races.
				const d = deferred<UserResponse>();
				this.promptWaiters.set(promptId, d);

				this.emit({
					type: "session:prompt",
					promptId,
					prompt,
					choices: options?.choices,
					allowText: options?.allowText ?? true,
				});

				return await d.promise;
			},
			hasMessages: () => this.injectedMessages.length > 0,
			readMessages: () => {
				const msgs = this.injectedMessages.slice();
				this.injectedMessages.length = 0;
				return msgs;
			},
			isAborted: () => this.aborted,
		};
	}

	getAgentMailbox(agentName: string): AgentMailbox {
		const existing = this.agentMailboxes.get(agentName);
		if (existing) return existing;
		const created = new AgentMailbox();
		this.agentMailboxes.set(agentName, created);
		return created;
	}

	registerRun(agentName: string, runId: string): AgentMailbox {
		const mailbox = new AgentMailbox();
		this.runMailboxes.set(runId, mailbox);

		const runs = this.activeRunsByAgent.get(agentName) ?? new Set<string>();
		runs.add(runId);
		this.activeRunsByAgent.set(agentName, runs);

		// Deliver any queued messages for this agent into the new run mailbox.
		const queued = this.queuedByAgent.get(agentName);
		if (queued?.length) {
			for (const msg of queued) mailbox.push(msg);
			this.queuedByAgent.delete(agentName);
		}

		return mailbox;
	}

	unregisterRun(agentName: string, runId: string): void {
		this.runMailboxes.delete(runId);
		const runs = this.activeRunsByAgent.get(agentName);
		if (!runs) return;
		runs.delete(runId);
		if (runs.size === 0) this.activeRunsByAgent.delete(agentName);
	}

	async run(): Promise<HarnessResult<TState, TResult>> {
		if (this._status !== "idle") throw new Error("Cannot run twice");
		this._status = "running";
		const start = Date.now();

		const cleanups: Array<() => void | Promise<void>> = [];
		for (const a of this.attachments) {
			const cleanup = a(this);
			if (typeof cleanup === "function") cleanups.push(cleanup);
		}

		this.emit({ type: "harness:start", name: this.name });

		try {
			const result = await this._runUserCode();
			const durationMs = Date.now() - start;
			if (this._status === "running") this._status = "complete";
			// If we got here, we weren't aborted (aborted runs should throw/cancel upstream).
			this.emit({ type: "harness:complete", success: true, durationMs });
			return { result, state: this.state, events: this.recorded.slice(), durationMs, status: this._status };
		} finally {
			for (let i = cleanups.length - 1; i >= 0; i--) {
				try {
					await cleanups[i]?.();
				} catch {
					// non-fatal
				}
			}
		}
	}
}

/**
 * Simple async mailbox:
 * - channels push via hub.sendTo(agent,...)
 * - agents consume via ctx.inbox (async iterable or pop/drain)
 */
class AgentMailbox implements AgentInbox {
	private items: InjectedMessage[] = [];
	private waiters: Array<(v: InjectedMessage) => void> = [];

	push(msg: InjectedMessage): void {
		const w = this.waiters.shift();
		if (w) w(msg);
		else this.items.push(msg);
	}

	async pop(): Promise<InjectedMessage> {
		if (this.items.length) return this.items.shift() as InjectedMessage;
		return await new Promise<InjectedMessage>((resolve) => this.waiters.push(resolve));
	}

	drain(): InjectedMessage[] {
		const out = this.items.slice();
		this.items.length = 0;
		return out;
	}

	[Symbol.asyncIterator](): AsyncIterator<InjectedMessage> {
		return {
			next: async () => {
				const value = await this.pop();
				return { done: false, value };
			},
		};
	}
}

export function defineHarness<TInput, TAgentDefs extends Record<string, AgentDefinition>, TState, TResult>(
	config: HarnessConfig<TInput, TAgentDefs, TState, TResult>,
): HarnessFactory<TInput, TState, TResult> {
	return {
		create(input: TInput) {
			const sessionId = randomUUID();
			const state = config.state(input);
			const hub = new HarnessHub<TState, TResult>({ name: config.name, state, sessionId });

			// Wrap agents:
			// - workflow calls: agents.foo.execute(input)
			// - internally: agent receives { hub } and has agent-scoped context + agent:start/complete events
			const agents = {} as unknown as ExecutableAgents<TAgentDefs>;
			for (const [key, agentDef] of Object.entries(config.agents)) {
				const agentName = agentDef.name ?? key;
				(agents as Record<string, unknown>)[key] = {
					name: agentName,
					execute: async (agentInput: unknown) => {
						const runId = `run-${randomUUID()}`;
						const mailbox = hub.registerRun(agentName, runId);
						const inbox = mailbox as unknown as AgentInbox;
						return await hub.scoped({ agent: { name: agentName } }, async () => {
							const emitsStartComplete = agentDef.emitsStartComplete === true;
							if (!emitsStartComplete) hub.emit({ type: "agent:start", agentName, runId });
							try {
								const out = await agentDef.execute(agentInput as never, {
									hub,
									inbox,
									runId,
								});
								if (!emitsStartComplete) hub.emit({ type: "agent:complete", agentName, success: true, runId });
								return out;
							} catch (e) {
								if (!emitsStartComplete) hub.emit({ type: "agent:complete", agentName, success: false, runId });
								throw e;
							} finally {
								hub.unregisterRun(agentName, runId);
							}
						});
					},
				};
			}

			(hub as unknown as { _runUserCode: () => Promise<TResult> })._runUserCode = async () => {
				const ctx: ExecuteContext<TAgentDefs, TState> = {
					agents,
					state,
					hub,
					emit: (event) => hub.emit(event),
					phase: async (name, fn) => {
						return await hub.scoped({ phase: { name } }, async () => {
							hub.emit({ type: "phase:start", name });
							try {
								const res = await fn();
								hub.emit({ type: "phase:complete", name });
								return res;
							} catch (e) {
								const message = e instanceof Error ? e.message : String(e);
								const stack = e instanceof Error ? e.stack : undefined;
								hub.emit({ type: "phase:failed", name, error: message, stack });
								throw e;
							}
						});
					},
					task: async (taskId, fn) => {
						return await hub.scoped({ task: { id: taskId } }, async () => {
							hub.emit({ type: "task:start", taskId });
							try {
								const res = await fn();
								hub.emit({ type: "task:complete", taskId, result: res });
								return res;
							} catch (e) {
								const message = e instanceof Error ? e.message : String(e);
								const stack = e instanceof Error ? e.stack : undefined;
								hub.emit({ type: "task:failed", taskId, error: message, stack });
								throw e;
							}
						});
					},
					...(hub.sessionActive ? { session: hub.createSessionContext() } : {}),
				};

				// StartSession() can be called before run() — reflect that here.
				if (hub.sessionActive) ctx.session = hub.createSessionContext();

				return await config.run(ctx, input);
			};

			return hub as unknown as HarnessInstance<TState, TResult>;
		},
	};
}
