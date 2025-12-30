// Engine: Harness
// Implements docs/spec/harness.md

import type {
	AgentDefinition,
	AgentExecuteContext,
	ExecutableAgent,
} from "../protocol/agent.js";
import type { BaseEvent, EnrichedEvent } from "../protocol/events.js";
import type {
	Attachment,
	Cleanup,
	ExecuteContext,
	HarnessFactory,
	HarnessInstance,
	HarnessResult,
	SessionContext,
} from "../protocol/harness.js";
import type { UserResponse } from "../protocol/hub.js";
import { HubImpl } from "./hub.js";

/**
 * Session context implementation for interactive workflows.
 */
class SessionContextImpl implements SessionContext {
	private readonly messages: Array<{
		content: string;
		agent?: string;
		timestamp: Date;
	}> = [];
	private aborted = false;

	constructor(private readonly hub: HubImpl) {
		// Subscribe to session messages
		hub.subscribe("session:message", (event) => {
			this.messages.push({
				content: (event.event as { content: string }).content,
				agent: (event.event as { agentName?: string }).agentName,
				timestamp: event.timestamp,
			});
		});

		// Subscribe to abort events
		hub.subscribe("session:abort", () => {
			this.aborted = true;
		});
	}

	async waitForUser(
		prompt: string,
		options?: { choices?: string[]; allowText?: boolean },
	): Promise<UserResponse> {
		const promptId = `prompt-${Date.now()}-${Math.random()}`;
		this.hub.emit({
			type: "session:prompt",
			promptId,
			prompt,
			choices: options?.choices,
			allowText: options?.allowText,
		});

		// Wait for reply (simplified - in real implementation would use promise resolution)
		return new Promise<UserResponse>((resolve) => {
			const unsubscribe = this.hub.subscribe("session:reply", (event) => {
				const replyEvent = event.event as {
					type: string;
					promptId: string;
					content: string;
					choice?: string;
				};
				if (replyEvent.promptId === promptId) {
					unsubscribe();
					resolve({
						content: replyEvent.content,
						choice: replyEvent.choice,
						timestamp: new Date(),
					});
				}
			});
		});
	}

	hasMessages(): boolean {
		return this.messages.length > 0;
	}

	readMessages(): Array<{ content: string; agent?: string; timestamp: Date }> {
		const messages = [...this.messages];
		this.messages.length = 0;
		return messages;
	}

	isAborted(): boolean {
		return this.aborted;
	}
}

/**
 * Wraps AgentDefinition to provide ExecutableAgent interface.
 */
function wrapAgent<TIn, TOut>(
	definition: AgentDefinition<TIn, TOut>,
	hub: HubImpl,
	getRunId: () => string,
	getInbox: (runId: string) => AgentInbox,
): ExecutableAgent<TIn, TOut> {
	return {
		name: definition.name,
		async execute(input: TIn): Promise<TOut> {
			const runId = getRunId();
			const inbox = getInbox(runId);

			// Emit agent:start if not handled by agent
			if (!definition.emitsStartComplete) {
				hub.emit({
					type: "agent:start",
					agentName: definition.name,
					runId,
				});
			}

			const ctx: AgentExecuteContext = {
				hub,
				inbox,
				runId,
			};

			try {
				const result = await definition.execute(input, ctx);

				// Emit agent:complete if not handled by agent
				if (!definition.emitsStartComplete) {
					hub.emit({
						type: "agent:complete",
						agentName: definition.name,
						success: true,
						runId,
					});
				}

				return result;
			} catch (error) {
				if (!definition.emitsStartComplete) {
					hub.emit({
						type: "agent:complete",
						agentName: definition.name,
						success: false,
						runId,
					});
				}

				// Emit agent:failed
				hub.emit({
					type: "agent:failed",
					agentName: definition.name,
					runId,
					error: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		},
	};
}

/**
 * Simple inbox implementation (basic for Milestone 3, full routing in Milestone 4).
 */
interface AgentInbox {
	pop(): Promise<{ content: string; timestamp: Date }>;
	drain(): Array<{ content: string; timestamp: Date }>;
	[Symbol.asyncIterator](): AsyncIterableIterator<{
		content: string;
		timestamp: Date;
	}>;
}

class SimpleInbox implements AgentInbox {
	private readonly messages: Array<{ content: string; timestamp: Date }> = [];

	push(message: string): void {
		this.messages.push({
			content: message,
			timestamp: new Date(),
		});
	}

	async pop(): Promise<{ content: string; timestamp: Date }> {
		if (this.messages.length > 0) {
			const message = this.messages.shift();
			if (!message) {
				throw new Error("Expected message to be available");
			}
			return message;
		}
		// Block until message available (simplified)
		return new Promise((resolve) => {
			const check = setInterval(() => {
				if (this.messages.length > 0) {
					clearInterval(check);
					const message = this.messages.shift();
					if (!message) {
						throw new Error("Expected message to be available");
					}
					resolve(message);
				}
			}, 10);
		});
	}

	drain(): Array<{ content: string; timestamp: Date }> {
		const messages = [...this.messages];
		this.messages.length = 0;
		return messages;
	}

	async *[Symbol.asyncIterator](): AsyncIterableIterator<{
		content: string;
		timestamp: Date;
	}> {
		while (true) {
			yield await this.pop();
		}
	}
}

/**
 * Harness instance implementation.
 */
export class HarnessInstanceImpl<TState, TResult>
	extends HubImpl
	implements HarnessInstance<TState, TResult>
{
	readonly state: TState;
	private readonly attachments: Cleanup[] = [];
	private readonly agentDefs: Record<string, AgentDefinition>;
	private readonly runFn: (
		ctx: ExecuteContext<Record<string, AgentDefinition>, TState>,
	) => Promise<TResult>;
	private readonly workflowName: string;
	private _sessionContext: SessionContextImpl | null = null;
	private readonly inboxes = new Map<string, SimpleInbox>();
	private runIdCounter = 0;

	constructor(
		workflowName: string,
		sessionId: string,
		state: TState,
		agentDefs: Record<string, AgentDefinition>,
		runFn: (
			ctx: ExecuteContext<Record<string, AgentDefinition>, TState>,
		) => Promise<TResult>,
	) {
		super(sessionId);
		this.workflowName = workflowName;
		this.state = state;
		this.agentDefs = agentDefs;
		this.runFn = runFn;
	}

	attach(attachment: Attachment): this {
		const cleanup = attachment(this);
		if (cleanup) {
			this.attachments.push(cleanup);
		}
		return this;
	}

	startSession(): this {
		super.startSession();
		this._sessionContext = new SessionContextImpl(this);
		return this;
	}

	private getRunId(): string {
		return `run-${this.runIdCounter++}`;
	}

	private getInbox(runId: string): SimpleInbox {
		let inbox = this.inboxes.get(runId);
		if (!inbox) {
			inbox = new SimpleInbox();
			this.inboxes.set(runId, inbox);
		}
		return inbox;
	}

	async run(): Promise<HarnessResult<TState, TResult>> {
		const startTime = Date.now();
		const events: EnrichedEvent[] = [];
		let success = false;
		let durationMs = 0;

		// Subscribe to capture all events
		const unsubscribe = this.subscribe("*", (event) => {
			events.push(event);
		});

		try {
			// Set status to running
			this.setStatus("running");

			// Emit harness:start
			this.emit({
				type: "harness:start",
				name: this.workflowName,
			});

			// Create executable agents
			const agents = Object.fromEntries(
				Object.entries(this.agentDefs).map(([key, def]) => [
					key,
					wrapAgent(
						def,
						this,
						() => this.getRunId(),
						(runId) => this.getInbox(runId),
					),
				]),
			) as ExecuteContext<Record<string, AgentDefinition>, TState>["agents"];

			// Create phase helper
			const phase = async <T>(
				name: string,
				fn: () => Promise<T>,
			): Promise<T> => {
				this.emit({
					type: "phase:start",
					name,
				});

				try {
					const result = await this.scoped({ phase: { name } }, fn);
					this.emit({
						type: "phase:complete",
						name,
					});
					return result;
				} catch (error) {
					this.emit({
						type: "phase:failed",
						name,
						error: error instanceof Error ? error.message : String(error),
					});
					throw error;
				}
			};

			// Create task helper
			const task = async <T>(id: string, fn: () => Promise<T>): Promise<T> => {
				this.emit({
					type: "task:start",
					taskId: id,
				});

				try {
					const result = await this.scoped({ task: { id } }, fn);
					this.emit({
						type: "task:complete",
						taskId: id,
						result,
					});
					return result;
				} catch (error) {
					this.emit({
						type: "task:failed",
						taskId: id,
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
					});
					throw error;
				}
			};

			// Create emit helper
			const emit = (event: BaseEvent): void => {
				this.emit(event);
			};

			// Create execute context
			const ctx: ExecuteContext<Record<string, AgentDefinition>, TState> = {
				agents,
				state: this.state,
				hub: this,
				phase,
				task,
				emit,
				session: this._sessionContext ?? undefined,
			};

			// Execute run function
			const result = await this.runFn(ctx);

			// Set status to complete
			this.setStatus("complete");

			success = true;
			durationMs = Date.now() - startTime;

			return {
				result,
				state: this.state,
				events,
				durationMs,
				status: this.status,
			};
		} catch (error) {
			// Set status based on error
			if (this.status === "aborted") {
				// Already aborted
			} else {
				this.setStatus("idle");
			}

			// Re-throw after cleanup
			throw error;
		} finally {
			if (durationMs === 0) {
				durationMs = Date.now() - startTime;
			}
			this.emit({
				type: "harness:complete",
				success,
				durationMs,
			});

			unsubscribe();

			// Run cleanup functions
			for (const cleanup of this.attachments) {
				if (typeof cleanup === "function") {
					try {
						await cleanup();
					} catch (error) {
						console.error("Cleanup error:", error);
					}
				}
			}
		}
	}
}

/**
 * Define a harness factory.
 */
export function defineHarness<
	TInput,
	TState,
	TResult,
	TAgentDefs extends Record<string, AgentDefinition>,
>(config: {
	name: string;
	agents: TAgentDefs;
	state: (input: TInput) => TState;
	run: (ctx: ExecuteContext<TAgentDefs, TState>) => Promise<TResult>;
}): HarnessFactory<TInput, TState, TResult> {
	return {
		create(
			input: TInput,
			options?: { sessionIdOverride?: string },
		): HarnessInstance<TState, TResult> {
			const sessionId =
				options?.sessionIdOverride ?? `${config.name}-${Date.now()}`;
			const state = config.state(input);
			const instance = new HarnessInstanceImpl(
				config.name,
				sessionId,
				state,
				config.agents as Record<string, AgentDefinition>,
				config.run as (
					ctx: ExecuteContext<Record<string, AgentDefinition>, TState>,
				) => Promise<TResult>,
			);
			return instance;
		},
	};
}
