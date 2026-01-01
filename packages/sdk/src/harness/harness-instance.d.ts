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
import type { Attachment, EnrichedEvent, EventFilter, EventListener, IUnifiedEventBus, Transport, TransportStatus, Unsubscribe, UserResponse } from "../infra/unified-events/types.js";
import type { AgentConstructor, ExecuteContext, ResolvedAgents } from "../factory/define-harness.js";
import type { FluentEventHandler, FluentHarnessEvent, HarnessEventType } from "./event-types.js";
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
 * Configuration passed to HarnessInstance constructor.
 */
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
/**
 * Running harness instance.
 * Supports chainable event subscription and execution.
 *
 * Implements the Transport interface for bidirectional communication.
 * HarnessInstance IS the Transport - no separate transport accessor needed.
 */
export declare class HarnessInstance<TAgents extends Record<string, AgentConstructor<any>>, TState, TResult> implements Partial<Transport> {
    private readonly _agents;
    private _state;
    private readonly _runFn;
    private readonly _input;
    private readonly _unifiedBus;
    private readonly _subscriptions;
    private readonly _events;
    private _completed;
    private _status;
    private _sessionActive;
    private readonly _transportListeners;
    private readonly _attachments;
    private readonly _cleanups;
    private readonly _messageQueue;
    private readonly _promptResolvers;
    private readonly _abortController;
    private _promptIdCounter;
    private _sessionContext;
    constructor(config: HarnessInstanceConfig<TAgents, TState, unknown, TResult>);
    /**
     * Access current state (readonly from external perspective).
     */
    get state(): TState;
    /**
     * Current transport status (FR-008).
     *
     * State transitions:
     * - idle → running (on run() or complete())
     * - running → complete (normal completion)
     * - running → aborted (on abort())
     */
    get status(): TransportStatus;
    /**
     * Whether session mode is active (FR-009).
     *
     * When true, commands (send, reply, abort) are processed.
     * When false (default), commands are no-ops.
     */
    get sessionActive(): boolean;
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
    attach(attachment: Attachment): this;
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
    startSession(): this;
    /**
     * Execute interactive session to completion (FR-015).
     *
     * Like run() but for session mode workflows that use waitForUser().
     * Must be called after startSession().
     *
     * @returns Result containing return value, final state, events, duration
     */
    complete(): Promise<HarnessResult<TState, TResult>>;
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
    /**
     * Inject a user message into the execution (FR-004).
     * Message is queued and available via session.readMessages().
     * No-op if session mode not active.
     *
     * @param message - Message content
     */
    send(message: string): void;
    /**
     * Send message to a specific agent (FR-005).
     * Message is queued with agent targeting.
     * No-op if session mode not active.
     *
     * @param agent - Target agent name
     * @param message - Message content
     */
    sendTo(agent: string, message: string): void;
    /**
     * Reply to a user:prompt event (FR-006).
     * Resolves the pending waitForUser() promise.
     * No-op if session mode not active or promptId unknown.
     *
     * @param promptId - ID from session:prompt event
     * @param response - User's response
     */
    reply(promptId: string, response: UserResponse): void;
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
    abort(reason?: string): void;
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
    [Symbol.asyncIterator](): AsyncIterator<EnrichedEvent>;
    /**
     * Chainable event subscription.
     * Returns this for method chaining.
     *
     * @param type - Event type to subscribe to ('*' for all)
     * @param handler - Callback for events
     * @returns this (for chaining)
     */
    on<E extends HarnessEventType>(type: E, handler: FluentEventHandler<E>): this;
    /**
     * Execute the harness.
     * Runs the configured run() function.
     * Cleans up all event subscriptions on completion.
     *
     * @returns Result containing return value, final state, events, duration
     */
    run(): Promise<HarnessResult<TState, TResult>>;
    /**
     * Emit an event to all subscribers.
     * No-op if harness has completed (per spec edge case).
     *
     * @internal
     */
    private _emit;
    /**
     * Check if an event should be delivered based on subscription type.
     */
    private _shouldDeliver;
    /**
     * Create the execute context with bound helpers.
     * Helpers are bound fresh at each run() invocation.
     */
    private _createExecuteContext;
}
