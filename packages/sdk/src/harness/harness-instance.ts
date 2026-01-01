/**
 * HarnessInstance - Running harness with event subscription and execution
 *
 * Provides the runtime instance for fluent harness API:
 * - Chainable event subscription via .on()
 * - Execution via .run()
 * - Auto-cleanup of subscriptions on completion
 *
 * @module harness/harness-instance
 */

import { matchesFilter } from "../infra/unified-events/filter.js";
import type {
	Attachment,
	EnrichedEvent,
	EventFilter,
	EventListener,
	InjectedMessage,
	IUnifiedEventBus,
	Transport,
	TransportStatus,
	Unsubscribe,
	UserResponse,
} from "../infra/unified-events/types.js";
import type { AgentConstructor, ExecuteContext, ResolvedAgents } from "../factory/define-harness.js";
import { AsyncQueue } from "../utils/async-queue.js";
import { createParallelHelper, createRetryHelper } from "./control-flow.js";
import type { FluentEventHandler, FluentHarnessEvent, HarnessEventType, PhaseEvent, TaskEvent } from "./event-types.js";
import { SessionContext, type SessionContextDeps } from "./session-context.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Deferred promise with external resolve/reject control.
 * Used for prompt/reply flow.
 */
interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
}

/**
 * Result of harness.run().
 * Contains the execution result, final state, collected events, and timing.
 */
export interface HarnessResult<TState, TResult> {
	/** Return value from run()/execute() */
	result: TResult;

	/** Final state after execution */
	state: TState;

	/** All events emitted during execution */
	events: FluentHarnessEvent[];

	/** Total execution time in milliseconds */
	duration: number;
}

/**
 * Internal subscription entry for tracking event handlers.
 */
interface Subscription {
	type: HarnessEventType;
	handler: (event: FluentHarnessEvent) => void;
}

/**
 * Configuration passed to HarnessInstance constructor.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for flexible agent typing
export interface HarnessInstanceConfig<TAgents extends Record<string, AgentConstructor<any>>, TState, TInput, TResult> {
	/** Harness name for debugging */
	name: string;

	/** Resolved agent instances */
	agents: ResolvedAgents<TAgents>;

	/** Initial state */
	state: TState;

	/** User's run function (simple async) */
	run?: (context: ExecuteContext<TAgents, TState>, input: TInput) => Promise<TResult>;

	/** Input passed to create() */
	input: TInput;

	/** Optional unified event bus for context propagation (008-unified-event-system) */
	unifiedBus?: IUnifiedEventBus;

	/** Pre-registered attachments from harness config (T058) */
	attachments?: Attachment[];
}

// ============================================================================
// HARNESS INSTANCE CLASS
// ============================================================================

/**
 * Running harness instance.
 * Supports chainable event subscription and execution.
 *
 * Implements the Transport interface for bidirectional communication.
 * HarnessInstance IS the Transport - no separate transport accessor needed.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for flexible agent typing
export class HarnessInstance<TAgents extends Record<string, AgentConstructor<any>>, TState, TResult>
	implements Partial<Transport>
{
	private readonly _agents: ResolvedAgents<TAgents>;
	private _state: TState;
	private readonly _runFn: ((context: ExecuteContext<TAgents, TState>, input: unknown) => Promise<TResult>) | undefined;
	private readonly _input: unknown;
	private readonly _unifiedBus: IUnifiedEventBus | undefined;

	private readonly _subscriptions: Subscription[] = [];
	private readonly _events: FluentHarnessEvent[] = [];
	private _completed = false;

	// Transport status (FR-008)
	private _status: TransportStatus = "idle";

	// Session mode (FR-009) - will be fully implemented in Phase 4
	private _sessionActive = false;

	// Transport event listeners (FR-002) - using unified bus pattern
	private readonly _transportListeners: Array<{
		filter: EventFilter | null;
		listener: EventListener;
	}> = [];

	// Attachment tracking (FR-001) - User Story 1
	private readonly _attachments: Attachment[] = [];
	private readonly _cleanups: Array<() => void | Promise<void>> = [];

	// Session infrastructure (FR-013, FR-017) - User Story 2
	private readonly _messageQueue: AsyncQueue<InjectedMessage> = new AsyncQueue();
	private readonly _promptResolvers: Map<string, Deferred<UserResponse>> = new Map();
	private readonly _abortController: AbortController = new AbortController();
	private _promptIdCounter = 0;
	private _sessionContext: SessionContext | undefined;

	constructor(config: HarnessInstanceConfig<TAgents, TState, unknown, TResult>) {
		this._agents = config.agents;
		this._state = config.state;
		this._runFn = config.run;
		this._input = config.input;
		this._unifiedBus = config.unifiedBus;

		// T059: Pre-register attachments from config
		if (config.attachments) {
			for (const attachment of config.attachments) {
				this._attachments.push(attachment);
			}
		}
	}

	/**
	 * Access current state (readonly from external perspective).
	 */
	get state(): TState {
		return this._state;
	}

	// =========================================================================
	// TRANSPORT INTERFACE - Status Properties (FR-008, FR-009)
	// =========================================================================

	/**
	 * Current transport status (FR-008).
	 *
	 * State transitions:
	 * - idle → running (on run() or complete())
	 * - running → complete (normal completion)
	 * - running → aborted (on abort())
	 */
	get status(): TransportStatus {
		return this._status;
	}

	/**
	 * Whether session mode is active (FR-009).
	 *
	 * When true, commands (send, reply, abort) are processed.
	 * When false (default), commands are no-ops.
	 */
	get sessionActive(): boolean {
		return this._sessionActive;
	}

	// =========================================================================
	// ATTACHMENT API (FR-001) - User Story 1
	// =========================================================================

	/**
	 * Attach a consumer to the transport (FR-001).
	 *
	 * Attachments are called with the transport when run() starts.
	 * If they return a cleanup function, it's called when run() completes.
	 *
	 * @param attachment - Function that receives transport and optionally returns cleanup
	 * @returns this (for method chaining)
	 * @throws Error if called after run() has started
	 *
	 * @example
	 * ```typescript
	 * harness
	 *   .attach(consoleRenderer)
	 *   .attach(metricsCollector)
	 *   .run();
	 * ```
	 */
	attach(attachment: Attachment): this {
		// T019: Throw error if attach() called after run() started
		if (this._status !== "idle") {
			throw new Error("Cannot attach after run() has started");
		}

		this._attachments.push(attachment);
		return this;
	}

	// =========================================================================
	// SESSION MODE API (FR-013, FR-015) - User Story 2
	// =========================================================================

	/**
	 * Enable session mode for interactive workflows (FR-013).
	 *
	 * When session mode is active:
	 * - Commands (send, reply, abort) are processed
	 * - ExecuteContext includes session property with waitForUser()
	 * - Use complete() instead of run() to execute
	 *
	 * @returns this (for method chaining)
	 * @throws Error if called after execution started
	 *
	 * @example
	 * ```typescript
	 * const result = await harness
	 *   .attach(promptHandler)
	 *   .startSession()
	 *   .complete();
	 * ```
	 */
	startSession(): this {
		if (this._status !== "idle") {
			throw new Error("Cannot start session after run() has started");
		}

		this._sessionActive = true;

		// Create SessionContext with dependencies
		const deps: SessionContextDeps = {
			messageQueue: this._messageQueue,
			promptResolvers: this._promptResolvers,
			abortController: this._abortController,
			emitPrompt: (promptId: string, prompt: string, choices?: string[]) => {
				// T032: Emit session:prompt event when waitForUser() called
				this._emit({
					type: "session:prompt",
					promptId,
					prompt,
					choices,
					timestamp: new Date(),
				} as FluentHarnessEvent);
			},
			generatePromptId: () => `prompt-${++this._promptIdCounter}`,
		};

		this._sessionContext = new SessionContext(deps);
		return this;
	}

	/**
	 * Execute interactive session to completion (FR-015).
	 *
	 * Like run() but for session mode workflows that use waitForUser().
	 * Must be called after startSession().
	 *
	 * @returns Result containing return value, final state, events, duration
	 */
	async complete(): Promise<HarnessResult<TState, TResult>> {
		// complete() is essentially run() but with session mode already enabled
		return this.run();
	}

	// =========================================================================
	// TRANSPORT INTERFACE - Event Subscription (FR-002)
	// =========================================================================

	/**
	 * Subscribe to events with optional filter (FR-002).
	 *
	 * @param filterOrListener - Event filter pattern or listener function
	 * @param maybeListener - Listener function (when filter provided)
	 * @returns Unsubscribe function
	 *
	 * @example
	 * ```typescript
	 * // Subscribe to all events
	 * const unsub = harness.subscribe((event) => console.log(event));
	 *
	 * // Subscribe with filter
	 * const unsub = harness.subscribe('task:*', (event) => console.log(event));
	 * ```
	 */
	subscribe(listener: EventListener): Unsubscribe;
	subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;
	subscribe(filterOrListener: EventFilter | EventListener, maybeListener?: EventListener): Unsubscribe {
		let filter: EventFilter | null = null;
		let listener: EventListener;

		if (typeof filterOrListener === "function") {
			// subscribe(listener) form
			listener = filterOrListener;
		} else {
			// subscribe(filter, listener) form
			filter = filterOrListener;
			if (!maybeListener) {
				throw new Error("subscribe(filter, listener) requires listener argument");
			}
			listener = maybeListener;
		}

		const entry = { filter, listener };
		this._transportListeners.push(entry);

		// Return unsubscribe function
		return () => {
			const index = this._transportListeners.indexOf(entry);
			if (index !== -1) {
				this._transportListeners.splice(index, 1);
			}
		};
	}

	// =========================================================================
	// TRANSPORT INTERFACE - Stub Methods (to be implemented in later phases)
	// =========================================================================

	/**
	 * Inject a user message into the execution (FR-004).
	 * Message is queued and available via session.readMessages().
	 * No-op if session mode not active.
	 *
	 * @param message - Message content
	 */
	send(message: string): void {
		// T043: No-op if session mode not active
		if (!this._sessionActive) return;

		// T038: Queue message for workflow consumption
		this._messageQueue.push({
			content: message,
			timestamp: new Date(),
		});
	}

	/**
	 * Send message to a specific agent (FR-005).
	 * Message is queued with agent targeting.
	 * No-op if session mode not active.
	 *
	 * @param agent - Target agent name
	 * @param message - Message content
	 */
	sendTo(agent: string, message: string): void {
		// T043: No-op if session mode not active
		if (!this._sessionActive) return;

		// T039: Queue message with agent targeting
		this._messageQueue.push({
			content: message,
			agent,
			timestamp: new Date(),
		});
	}

	/**
	 * Reply to a user:prompt event (FR-006).
	 * Resolves the pending waitForUser() promise.
	 * No-op if session mode not active or promptId unknown.
	 *
	 * @param promptId - ID from session:prompt event
	 * @param response - User's response
	 */
	reply(promptId: string, response: UserResponse): void {
		// T024: No-op if session mode not active
		if (!this._sessionActive) return;

		// T030: Resolve pending prompt promise
		const deferred = this._promptResolvers.get(promptId);
		if (!deferred) {
			// T063: First-reply-wins - unknown promptId means already replied or invalid
			// Subsequent replies are silently ignored per spec.md:174
			return;
		}

		// T063: First-reply-wins - delete immediately before resolving
		// This ensures concurrent replies don't both succeed
		this._promptResolvers.delete(promptId);

		// Resolve the waiting promise
		deferred.resolve(response);

		// T033: Emit session:reply event when reply() resolves waitForUser
		this._emit({
			type: "session:reply",
			promptId,
			response,
			timestamp: new Date(),
		} as FluentHarnessEvent);
	}

	/**
	 * Request graceful abort (FR-007).
	 * Idempotent - second call is no-op.
	 *
	 * T049: Implement abort(reason) calling abortController.abort()
	 * T050: Transition status to 'aborted' on abort()
	 * T051: Emit session:abort event when abort() called
	 * T053: Cleanup functions called via _runCleanups() when abort triggers completion
	 *
	 * @param reason - Optional abort reason
	 */
	abort(reason?: string): void {
		// Idempotent - only abort once
		if (this._status === "aborted" || this._status === "complete") return;

		// No-op if session not active (non-interactive mode)
		if (!this._sessionActive) return;

		// T050: Transition status to 'aborted'
		this._status = "aborted";

		// T051: Emit session:abort event
		this._emit({
			type: "session:abort",
			reason,
			timestamp: new Date(),
		} as FluentHarnessEvent);

		// T049: Call abortController.abort() to signal abort to waiters
		this._abortController.abort(reason);

		// Cancel any pending message queue waiters
		this._messageQueue.cancelWaiters(new Error(reason ?? "Aborted"));

		// T053: Run cleanup functions (called via _runCleanups in catch block of complete())
		// The abort signal will cause pending waitForUser() calls to reject,
		// which will propagate up and trigger cleanup in the finally block
	}

	/**
	 * Async iteration over all events (FR-003).
	 *
	 * Allows streaming events as they are emitted:
	 * ```typescript
	 * for await (const event of harness) {
	 *   console.log(event.type);
	 * }
	 * ```
	 *
	 * The iterator completes when the harness run completes.
	 */
	[Symbol.asyncIterator](): AsyncIterator<EnrichedEvent> {
		// T042: Create async iterator over events
		const eventQueue = new AsyncQueue<EnrichedEvent>();
		let closed = false;

		// Subscribe to all events and push to queue
		const unsub = this.subscribe((event) => {
			if (!closed) {
				eventQueue.push(event);
			}
		});

		// Track completion to close the queue
		const checkCompletion = () => {
			if (this._completed && !closed) {
				closed = true;
				eventQueue.close();
				unsub();
			}
		};

		return {
			next: async (): Promise<IteratorResult<EnrichedEvent>> => {
				// Check if already complete
				checkCompletion();

				if (closed && eventQueue.isEmpty) {
					return { done: true, value: undefined };
				}

				// Wait for next event or completion
				const event = await eventQueue.pop();

				if (event === undefined) {
					// Queue was closed
					return { done: true, value: undefined };
				}

				// Check again after getting event
				checkCompletion();

				return { done: false, value: event };
			},
		};
	}

	// =========================================================================
	// FLUENT EVENT API (existing)
	// =========================================================================

	/**
	 * Chainable event subscription.
	 * Returns this for method chaining.
	 *
	 * @param type - Event type to subscribe to ('*' for all)
	 * @param handler - Callback for events
	 * @returns this (for chaining)
	 */
	on<E extends HarnessEventType>(type: E, handler: FluentEventHandler<E>): this {
		this._subscriptions.push({
			type,
			handler: handler as (event: FluentHarnessEvent) => void,
		});
		return this;
	}

	/**
	 * Execute the harness.
	 * Runs the configured run() function.
	 * Cleans up all event subscriptions on completion.
	 *
	 * @returns Result containing return value, final state, events, duration
	 */
	async run(): Promise<HarnessResult<TState, TResult>> {
		const startTime = Date.now();

		// T020: Transition status to 'running'
		this._status = "running";

		// T017: Call attachments on run() start, store returned cleanup
		for (const attachment of this._attachments) {
			const cleanup = attachment(this as unknown as Transport);
			if (cleanup) {
				this._cleanups.push(cleanup);
			}
		}

		try {
			// Create execute context with bound helpers
			const context = this._createExecuteContext();

			// Execute user's run function
			let result: TResult;
			if (this._runFn) {
				result = await this._runFn(context, this._input);
			} else {
				// No run function provided - return undefined as result
				result = undefined as TResult;
			}

			const duration = Date.now() - startTime;

			// T020: Transition status to 'complete' on success
			this._status = "complete";

			return {
				result,
				state: this._state,
				events: [...this._events],
				duration,
			};
		} finally {
			// T018: Call all cleanup functions in reverse order (LIFO)
			for (let i = this._cleanups.length - 1; i >= 0; i--) {
				try {
					const cleanup = this._cleanups[i];
					if (cleanup) {
						await cleanup();
					}
				} catch {
					// Cleanup errors are non-critical - continue with other cleanups
				}
			}

			// Mark as completed and cleanup
			this._completed = true;
			this._subscriptions.length = 0;
		}
	}

	/**
	 * Emit an event to all subscribers.
	 * No-op if harness has completed (per spec edge case).
	 *
	 * @internal
	 */
	private _emit(event: FluentHarnessEvent): void {
		// No-op after completion (spec.md:157-161)
		if (this._completed) {
			return;
		}

		// Collect event
		this._events.push(event);

		// Deliver to fluent .on() subscribers
		for (const subscription of this._subscriptions) {
			if (this._shouldDeliver(event, subscription.type)) {
				try {
					subscription.handler(event);
				} catch (_error) {
					// Event handler errors are non-critical (spec.md:151-155) - silently continue
				}
			}
		}

		// Deliver to Transport.subscribe() listeners
		// Note: FluentHarnessEvent has 'type' at top level, which works with EventListener
		for (const { filter, listener } of this._transportListeners) {
			// Check if filter matches (null filter means all events)
			if (filter === null || matchesFilter(event.type, filter)) {
				try {
					// Cast event to EnrichedEvent format that listeners expect
					// FluentHarnessEvent has type at top level, EnrichedEvent has it in .event
					listener(event as unknown as EnrichedEvent);
				} catch (_error) {
					// Listener errors are non-critical - silently continue
				}
			}
		}
	}

	/**
	 * Check if an event should be delivered based on subscription type.
	 */
	private _shouldDeliver(event: FluentHarnessEvent, subscriptionType: HarnessEventType): boolean {
		// Wildcard matches all
		if (subscriptionType === "*") {
			return true;
		}

		// Check for direct match or prefix match (retry:* events match 'retry')
		const eventType = event.type;
		if (eventType === subscriptionType) {
			return true;
		}

		// Handle compound events (retry:start, parallel:item:complete, etc.)
		if (eventType.startsWith(`${subscriptionType}:`)) {
			return true;
		}

		return false;
	}

	/**
	 * Create the execute context with bound helpers.
	 * Helpers are bound fresh at each run() invocation.
	 */
	private _createExecuteContext(): ExecuteContext<TAgents, TState> {
		const self = this;

		return {
			agents: this._agents,
			state: this._state,

			// Phase helper - wraps with auto events and unified context (T017)
			async phase<T>(name: string, fn: () => Promise<T>): Promise<T> {
				// Wrapper function that handles phase execution with events
				const executePhase = async (): Promise<T> => {
					const timestamp = new Date();

					// Emit start event (inside scope so it inherits context)
					self._emit({
						type: "phase",
						name,
						status: "start",
						timestamp,
					} as PhaseEvent);

					// Emit to unified bus if available
					if (self._unifiedBus) {
						self._unifiedBus.emit({ type: "phase:start", name });
					}

					try {
						const result = await fn();

						// Emit complete event
						self._emit({
							type: "phase",
							name,
							status: "complete",
							timestamp: new Date(),
							result,
						} as PhaseEvent);

						// Emit to unified bus if available
						if (self._unifiedBus) {
							self._unifiedBus.emit({ type: "phase:complete", name });
						}

						return result;
					} catch (error) {
						// Emit failed event
						const message = error instanceof Error ? error.message : String(error);
						const stack = error instanceof Error ? error.stack : undefined;

						self._emit({
							type: "phase",
							name,
							status: "failed",
							timestamp: new Date(),
							error: message,
							stack,
						} as PhaseEvent);

						// Always re-throw (Contextual Event Wrapper Pattern)
						throw error;
					}
				};

				// If unified bus available, wrap in scoped context for context propagation
				if (self._unifiedBus) {
					return self._unifiedBus.scoped({ phase: { name } }, executePhase);
				}
				return executePhase();
			},

			// Task helper - wraps with auto events and unified context (T018)
			async task<T>(id: string, fn: () => Promise<T>): Promise<T> {
				// Wrapper function that handles task execution with events
				const executeTask = async (): Promise<T> => {
					const timestamp = new Date();

					// Emit start event (inside scope so it inherits context)
					self._emit({
						type: "task",
						id,
						status: "start",
						timestamp,
					} as TaskEvent);

					// Emit to unified bus if available
					if (self._unifiedBus) {
						self._unifiedBus.emit({ type: "task:start", taskId: id });
					}

					try {
						const result = await fn();

						// Emit complete event
						self._emit({
							type: "task",
							id,
							status: "complete",
							timestamp: new Date(),
							result,
						} as TaskEvent);

						// Emit to unified bus if available
						if (self._unifiedBus) {
							self._unifiedBus.emit({ type: "task:complete", taskId: id, result });
						}

						return result;
					} catch (error) {
						// Emit failed event
						const message = error instanceof Error ? error.message : String(error);
						const stack = error instanceof Error ? error.stack : undefined;

						self._emit({
							type: "task",
							id,
							status: "failed",
							timestamp: new Date(),
							error: message,
							stack,
						} as TaskEvent);

						// Emit to unified bus if available
						if (self._unifiedBus) {
							self._unifiedBus.emit({ type: "task:failed", taskId: id, error: message, stack });
						}

						// Always re-throw (Contextual Event Wrapper Pattern)
						throw error;
					}
				};

				// If unified bus available, wrap in scoped context for context propagation
				if (self._unifiedBus) {
					return self._unifiedBus.scoped({ task: { id } }, executeTask);
				}
				return executeTask();
			},

			// Emit escape hatch for custom events
			emit(type: string, data: Record<string, unknown>): void {
				self._emit({
					type,
					timestamp: new Date(),
					...data,
				} as FluentHarnessEvent);
			},

			// Create bound helpers using the emit function
			retry: createRetryHelper((event) => self._emit(event)),

			parallel: createParallelHelper((event) => self._emit(event)),

			// T034: Add session property to ExecuteContext when sessionActive
			// Only available when startSession() was called
			...(self._sessionActive && self._sessionContext ? { session: self._sessionContext } : {}),
		} as ExecuteContext<TAgents, TState>;
	}
}
