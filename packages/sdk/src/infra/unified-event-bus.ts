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

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { injectable } from "@needle-di/core";
import { matchesFilter } from "./unified-events/filter.js";
import type {
	BaseEvent,
	EnrichedEvent,
	EventContext,
	EventFilter,
	IUnifiedEventBus,
	UnifiedEventListener,
	Unsubscribe,
} from "./unified-events/types.js";

/**
 * Internal subscriber entry with filter pattern
 */
interface Subscriber {
	filter: EventFilter;
	listener: UnifiedEventListener;
}

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
@injectable()
export class UnifiedEventBus implements IUnifiedEventBus {
	/**
	 * AsyncLocalStorage for context propagation through async boundaries
	 */
	private readonly asyncStorage: AsyncLocalStorage<EventContext>;

	/**
	 * Session identifier - generated once per bus instance
	 */
	private readonly sessionId: string;

	/**
	 * Registered subscribers with their filter patterns
	 */
	private subscribers: Subscriber[] = [];

	/**
	 * Create a new UnifiedEventBus instance.
	 *
	 * @throws {Error} If AsyncLocalStorage is not available (Node.js < 12.17.0)
	 */
	constructor() {
		// Validate AsyncLocalStorage availability
		if (typeof AsyncLocalStorage === "undefined") {
			throw new Error(
				"UnifiedEventBus requires AsyncLocalStorage from node:async_hooks. " +
					"Ensure you are running Node.js 12.17.0+ or Bun.",
			);
		}

		this.asyncStorage = new AsyncLocalStorage<EventContext>();
		this.sessionId = randomUUID();
	}

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
	scoped<T>(context: Partial<EventContext>, fn: () => T | Promise<T>): T | Promise<T> {
		// Get current context (or minimal context if none)
		const current = this.current();

		// Merge contexts - new context overrides current
		const merged: EventContext = {
			sessionId: context.sessionId ?? current.sessionId,
			phase: context.phase ?? current.phase,
			task: context.task ?? current.task,
			agent: context.agent ?? current.agent,
		};

		// Run function within the new context scope
		return this.asyncStorage.run(merged, fn);
	}

	/**
	 * Get current context from AsyncLocalStorage.
	 *
	 * @returns Current EventContext. Returns minimal context (sessionId only)
	 *          if no scope is active.
	 */
	current(): EventContext {
		const store = this.asyncStorage.getStore();

		// Return stored context or minimal context with just sessionId
		return store ?? { sessionId: this.sessionId };
	}

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
	emit(event: BaseEvent, override?: Partial<EventContext>): void {
		// Get current context
		const currentContext = this.current();

		// Merge with override if provided
		const context: EventContext = override
			? {
					sessionId: override.sessionId ?? currentContext.sessionId,
					phase: override.phase ?? currentContext.phase,
					task: override.task ?? currentContext.task,
					agent: override.agent ?? currentContext.agent,
				}
			: currentContext;

		// Create enriched event wrapper
		const enrichedEvent: EnrichedEvent = {
			id: randomUUID(),
			timestamp: new Date(),
			context,
			event,
		};

		// Deliver to all matching subscribers
		for (const { filter, listener } of this.subscribers) {
			if (matchesFilter(event.type, filter)) {
				try {
					// Fire-and-forget: invoke listener but don't await
					listener(enrichedEvent);
				} catch (_error) {
					// Silently continue - fire-and-forget pattern
				}
			}
		}
	}

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
	subscribe(filterOrListener: EventFilter | UnifiedEventListener, maybeListener?: UnifiedEventListener): Unsubscribe {
		// Determine filter and listener based on arguments
		let filter: EventFilter;
		let listener: UnifiedEventListener;

		if (typeof filterOrListener === "function") {
			// Called as subscribe(listener) - default to wildcard
			filter = "*";
			listener = filterOrListener;
		} else if (maybeListener !== undefined) {
			// Called as subscribe(filter, listener)
			filter = filterOrListener;
			listener = maybeListener;
		} else {
			// Invalid call - filter provided but no listener
			throw new Error("subscribe() requires a listener when a filter is provided");
		}

		// Create subscriber entry
		const subscriber: Subscriber = { filter, listener };
		this.subscribers.push(subscriber);

		// Return unsubscribe function
		return () => {
			const index = this.subscribers.indexOf(subscriber);
			if (index > -1) {
				this.subscribers.splice(index, 1);
			}
		};
	}

	/**
	 * Remove all subscribers.
	 * Useful for testing or cleanup.
	 */
	clear(): void {
		this.subscribers = [];
	}

	/**
	 * Get number of active subscribers.
	 */
	get subscriberCount(): number {
		return this.subscribers.length;
	}
}
