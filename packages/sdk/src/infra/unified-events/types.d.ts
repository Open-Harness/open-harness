/**
 * Unified Event Bus Types
 *
 * Interface and type definitions for the unified event system.
 * Imports core types from @openharness/core and defines SDK-specific extensions.
 *
 * @module core/unified-events/types
 */
import type { AgentCompleteEvent, AgentStartEvent, AgentTextEvent, AgentThinkingEvent, AgentToolCompleteEvent, AgentToolStartEvent, BaseEvent, EnrichedEvent, EventContext, EventFilter, HarnessCompleteEvent, HarnessStartEvent, NarrativeEvent, PhaseCompleteEvent, PhaseStartEvent, SessionAbortEvent, SessionPromptEvent, SessionReplyEvent, TaskCompleteEvent, TaskFailedEvent, TaskStartEvent, Unsubscribe } from "@openharness/core";
import { z } from "zod";
export type { AgentCompleteEvent, AgentContext, AgentStartEvent, AgentTextEvent, AgentThinkingEvent, AgentToolCompleteEvent, AgentToolStartEvent, BaseEvent, BaseEventPayload, EnrichedEvent, EventContext, EventFilter, EventListener as UnifiedEventListener, ExtensionEvent, HarnessCompleteEvent, HarnessStartEvent, NarrativeEvent, NarrativeImportance, PhaseCompleteEvent, PhaseContext, PhaseStartEvent, SessionAbortEvent, SessionPromptEvent, SessionReplyEvent, TaskCompleteEvent, TaskContext, TaskFailedEvent, TaskStartEvent, Unsubscribe, } from "@openharness/core";
/** Check if event is a workflow event (harness/phase/task) */
export declare function isWorkflowEvent(event: BaseEvent): event is HarnessStartEvent | HarnessCompleteEvent | PhaseStartEvent | PhaseCompleteEvent | TaskStartEvent | TaskCompleteEvent | TaskFailedEvent;
/** Check if event is an agent event */
export declare function isAgentEvent(event: BaseEvent): event is AgentStartEvent | AgentThinkingEvent | AgentTextEvent | AgentToolStartEvent | AgentToolCompleteEvent | AgentCompleteEvent;
/** Check if event is a narrative event */
export declare function isNarrativeEvent(event: BaseEvent): event is NarrativeEvent;
/** Check if event is a session event */
export declare function isSessionEvent(event: BaseEvent): event is SessionPromptEvent | SessionReplyEvent | SessionAbortEvent;
/**
 * Unified Event Bus interface.
 * Central event infrastructure with AsyncLocalStorage context propagation.
 *
 * This extends the core IEventBus with SDK-specific features like
 * AsyncLocalStorage scoping and the `scoped()` method.
 */
export interface IUnifiedEventBus {
    /**
     * Execute function within a context scope.
     * Context survives async boundaries via AsyncLocalStorage.
     *
     * @param context - Partial context to add/override
     * @param fn - Function to execute within scope
     * @returns Function result
     */
    scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T>;
    /**
     * Emit an event with auto-attached context.
     *
     * @param event - Event to emit
     * @param override - Optional context override (merged with inherited)
     */
    emit(event: BaseEvent, override?: Partial<EventContext>): void;
    /**
     * Subscribe to events with optional filter.
     *
     * @param filter - Event type pattern(s). Default: '*' (all)
     * @param listener - Callback for matching events
     * @returns Unsubscribe function
     */
    subscribe(listener: (event: EnrichedEvent) => void | Promise<void>): Unsubscribe;
    subscribe(filter: EventFilter, listener: (event: EnrichedEvent) => void | Promise<void>): Unsubscribe;
    /**
     * Get current context from AsyncLocalStorage.
     *
     * @returns Current EventContext (minimal if no scope active)
     */
    current(): EventContext;
    /**
     * Remove all subscribers.
     */
    clear(): void;
    /**
     * Get number of active subscribers.
     */
    readonly subscriberCount: number;
}
/**
 * Event listener callback type for Transport subscriptions.
 */
export type EventListener = (event: EnrichedEvent) => void | Promise<void>;
/**
 * Transport execution status.
 *
 * State transitions:
 * - idle → running (on run() or complete())
 * - running → complete (normal completion)
 * - running → aborted (on abort())
 */
export type TransportStatus = "idle" | "running" | "complete" | "aborted";
/**
 * Bidirectional communication channel between harness and consumers.
 *
 * Provides:
 * - Events (out): subscribe(), async iteration
 * - Commands (in): send(), reply(), abort()
 * - Status: status, sessionActive
 *
 * HarnessInstance implements this interface directly.
 *
 * NOTE: This extends core's EventHub with async iteration support.
 */
export interface Transport extends AsyncIterable<EnrichedEvent> {
    /**
     * Subscribe to events with optional filter.
     *
     * @param listener - Callback for events
     * @returns Unsubscribe function
     *
     * @example
     * ```typescript
     * const unsub = transport.subscribe((event) => console.log(event));
     * ```
     */
    subscribe(listener: EventListener): Unsubscribe;
    /**
     * Subscribe to filtered events.
     *
     * @param filter - Event type pattern(s): '*', 'task:*', ['agent:*', 'task:*']
     * @param listener - Callback for matching events
     * @returns Unsubscribe function
     *
     * @example
     * ```typescript
     * const unsub = transport.subscribe('task:*', (event) => console.log(event));
     * ```
     */
    subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;
    /**
     * Async iteration over all events.
     *
     * @example
     * ```typescript
     * for await (const event of transport) {
     *   console.log(event);
     * }
     * ```
     */
    [Symbol.asyncIterator](): AsyncIterator<EnrichedEvent>;
    /**
     * Inject a user message into the execution.
     *
     * Messages are queued and available via session.readMessages().
     * No-op if session mode not active.
     *
     * @param message - Message content
     */
    send(message: string): void;
    /**
     * Send message to a specific agent.
     *
     * No-op if session mode not active.
     *
     * @param agent - Target agent name
     * @param message - Message content
     */
    sendTo(agent: string, message: string): void;
    /**
     * Reply to a user:prompt event.
     *
     * Resolves the pending waitForUser() promise.
     * No-op if session mode not active or promptId unknown.
     *
     * @param promptId - ID from user:prompt event
     * @param response - User's response
     */
    reply(promptId: string, response: UserResponse): void;
    /**
     * Request graceful abort.
     *
     * Sets abort flag, workflows can check via session.isAborted().
     * Idempotent - second call is no-op.
     *
     * @param reason - Optional abort reason
     */
    abort(reason?: string): void;
    /**
     * Current transport status.
     */
    readonly status: TransportStatus;
    /**
     * Whether session mode is active (commands processed).
     */
    readonly sessionActive: boolean;
}
/**
 * Cleanup function returned by attachment.
 * May be sync or async.
 */
export type Cleanup = void | (() => void) | (() => Promise<void>);
/**
 * Something that attaches to a transport and does stuff.
 *
 * Could be: renderer, metrics collector, API bridge, logger,
 * interactive prompt handler, abort controller, etc.
 *
 * The framework doesn't categorize. Attachments have full
 * bidirectional access and can use either direction, both, or neither.
 *
 * @param transport - The transport to attach to
 * @returns Optional cleanup function
 *
 * @example
 * ```typescript
 * const consoleRenderer: Attachment = (transport) => {
 *   const unsub = transport.subscribe((event) => console.log(event));
 *   return unsub;
 * };
 * ```
 */
export type Attachment = (transport: Transport) => Cleanup;
/**
 * Zod schema for user prompt response.
 * Used for runtime validation at API boundaries.
 */
export declare const UserResponseSchema: z.ZodObject<{
    content: z.ZodString;
    choice: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
}, z.core.$strip>;
/**
 * Response from user prompt.
 *
 * @property content - The user's text response
 * @property choice - Selected choice (if choices were presented)
 * @property timestamp - When the response was received
 */
export type UserResponse = z.infer<typeof UserResponseSchema>;
/**
 * Options for waitForUser() prompt.
 *
 * @property timeout - Maximum wait time in ms (undefined = indefinite)
 * @property choices - Predefined choices to present
 * @property validator - Custom validation function
 */
export interface WaitOptions {
    timeout?: number;
    choices?: string[];
    validator?: (input: string) => boolean | string;
}
/**
 * Message injected via transport.send().
 */
export interface InjectedMessage {
    content: string;
    agent?: string;
    timestamp: Date;
}
/**
 * Session context available to workflows when in interactive mode.
 *
 * Only present in ExecuteContext when startSession() was called.
 */
export interface ISessionContext {
    /**
     * Block until user responds.
     *
     * Emits user:prompt event and waits for transport.reply().
     *
     * @param prompt - Prompt text to display
     * @param options - Wait options
     * @returns User's response
     * @throws {Error} If timeout exceeded (when timeout option set)
     */
    waitForUser(prompt: string, options?: WaitOptions): Promise<UserResponse>;
    /**
     * Check for injected messages (non-blocking).
     */
    hasMessages(): boolean;
    /**
     * Retrieve and clear injected messages.
     */
    readMessages(): InjectedMessage[];
    /**
     * Check if abort was requested.
     */
    isAborted(): boolean;
}
