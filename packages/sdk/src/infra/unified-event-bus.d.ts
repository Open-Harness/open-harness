/**
 * UnifiedEventBus - Central event infrastructure with AsyncLocalStorage context propagation
 *
 * Combines AgentEvent (SDK-level: thinking, tool calls) and HarnessEvent (workflow-level:
 * phases, tasks) into a single subscription API. Events automatically inherit contextual
 * information (session, phase, task, agent) without explicit parameter passing.
 *
 * Key features:
 * - AsyncLocalStorage for automatic context propagation through async boundaries
 * - Single subscription API for all event types
 * - EnrichedEvent wrapper with consistent metadata (id, timestamp, context)
 * - Filter-based subscriptions (wildcard, prefix, exact match)
 *
 * @module core/unified-event-bus
 */
import type { BaseEvent, EventContext, EventFilter, IUnifiedEventBus, UnifiedEventListener, Unsubscribe } from "./unified-events/types.js";
/**
 * UnifiedEventBus implementation with AsyncLocalStorage context propagation.
 *
 * The bus maintains context via AsyncLocalStorage, allowing events emitted anywhere
 * in an async call stack to automatically include the enclosing phase/task/agent context.
 *
 * @example
 * ```typescript
 * const bus = new UnifiedEventBus();
 *
 * // Subscribe to all events
 * bus.subscribe((event) => {
 *   console.log(`${event.event.type} in task ${event.context.task?.id}`);
 * });
 *
 * // Execute code within a task scope
 * await bus.scoped({ task: { id: 'T001' } }, async () => {
 *   // Events emitted here automatically include task context
 *   bus.emit({ type: 'agent:thinking', content: 'Working...' });
 * });
 * ```
 */
export declare class UnifiedEventBus implements IUnifiedEventBus {
    /**
     * AsyncLocalStorage for context propagation through async boundaries
     */
    private readonly asyncStorage;
    /**
     * Session identifier - generated once per bus instance
     */
    private readonly sessionId;
    /**
     * Registered subscribers with their filter patterns
     */
    private subscribers;
    /**
     * Create a new UnifiedEventBus instance.
     *
     * @throws {Error} If AsyncLocalStorage is not available (Node.js < 12.17.0)
     */
    constructor();
    /**
     * Execute function within a context scope.
     * Context survives async boundaries via AsyncLocalStorage.
     *
     * Nested scopes merge context with inner values overriding outer.
     *
     * @param context - Partial context to add/override
     * @param fn - Function to execute within scope
     * @returns Function result (preserves sync/async nature)
     *
     * @example
     * ```typescript
     * await bus.scoped({ phase: { name: 'Setup' } }, async () => {
     *   await bus.scoped({ task: { id: 'T001' } }, async () => {
     *     // Context here: { sessionId, phase: { name: 'Setup' }, task: { id: 'T001' } }
     *     bus.emit({ type: 'task:start', taskId: 'T001' });
     *   });
     * });
     * ```
     */
    scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T>;
    /**
     * Get current context from AsyncLocalStorage.
     *
     * @returns Current EventContext. Returns minimal context (sessionId only)
     *          if no scope is active.
     */
    current(): EventContext;
    /**
     * Emit an event with auto-attached context.
     *
     * The event is wrapped in an EnrichedEvent with:
     * - Unique event ID (UUID)
     * - Timestamp
     * - Current context (merged with optional override)
     *
     * Events are delivered synchronously. Listener errors are logged but don't
     * interrupt delivery to other listeners.
     *
     * @param event - Event to emit
     * @param override - Optional context override (merged with inherited context)
     */
    emit(event: BaseEvent, override?: Partial<EventContext>): void;
    /**
     * Subscribe to events with optional filter.
     *
     * @param filterOrListener - Event filter pattern(s) OR listener callback
     * @param maybeListener - Listener callback (if first arg is filter)
     * @returns Unsubscribe function
     *
     * @example
     * ```typescript
     * // Subscribe to all events
     * const unsub1 = bus.subscribe((event) => console.log(event));
     *
     * // Subscribe to task events only
     * const unsub2 = bus.subscribe('task:*', (event) => console.log(event));
     *
     * // Subscribe to multiple patterns
     * const unsub3 = bus.subscribe(['agent:*', 'narrative'], (event) => console.log(event));
     *
     * // Cleanup
     * unsub1();
     * ```
     */
    subscribe(listener: UnifiedEventListener): Unsubscribe;
    subscribe(filter: EventFilter, listener: UnifiedEventListener): Unsubscribe;
    /**
     * Remove all subscribers.
     * Useful for testing or cleanup.
     */
    clear(): void;
    /**
     * Get number of active subscribers.
     */
    get subscriberCount(): number;
}
