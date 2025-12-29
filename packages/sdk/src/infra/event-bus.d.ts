/**
 * EventBus - Cross-cutting communication for agent events
 *
 * Provides a pub/sub pattern for agent events, enabling:
 * - Recording of all events
 * - Monologue generation
 * - Metrics collection
 * - Custom integrations
 */
import type { AgentEvent } from "./tokens.js";
/**
 * Legacy EventBus interface (deprecated, use IUnifiedEventBus)
 */
export interface IEventBus {
    publish(event: AgentEvent): void;
    subscribe(listener: EventListener, options?: SubscribeOptions): () => void;
}
/**
 * Event listener type
 */
export type EventListener = (event: AgentEvent) => void | Promise<void>;
/**
 * Event filter predicate
 */
export type EventFilter = (event: AgentEvent) => boolean;
/**
 * Subscription options
 */
export interface SubscribeOptions {
    /** Filter events by type */
    eventTypes?: string[];
    /** Custom filter predicate */
    filter?: EventFilter;
    /** Agent name filter */
    agentName?: string;
    /** Session ID filter */
    sessionId?: string;
}
/**
 * Simple EventBus implementation for agent event distribution.
 *
 * Features:
 * - Synchronous event publishing (fire-and-forget)
 * - Optional filtering by event type, agent name, or session
 * - Unsubscribe support via returned cleanup function
 *
 * @example
 * ```typescript
 * const bus = new EventBus();
 *
 * // Subscribe to all events
 * const unsubscribe = bus.subscribe((event) => {
 *   console.log(`Event: ${event.event_type}`);
 * });
 *
 * // Subscribe to specific event types
 * bus.subscribe((event) => {
 *   console.log(`Tool called: ${event.tool_name}`);
 * }, { eventTypes: ['tool_call'] });
 *
 * // Publish an event
 * bus.publish({ event_type: 'text', content: 'Hello' });
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */
export declare class EventBus implements IEventBus {
    private listeners;
    /**
     * Publish an event to all subscribers.
     * Events are delivered synchronously. Listener errors are silently ignored.
     *
     * @param event - The agent event to publish
     */
    publish(event: AgentEvent): void;
    /**
     * Publish an event and wait for all async listeners.
     * Use when you need to ensure all listeners have processed.
     *
     * @param event - The agent event to publish
     */
    publishAsync(event: AgentEvent): Promise<void>;
    /**
     * Subscribe to agent events.
     *
     * @param listener - Callback to invoke for each event
     * @param options - Optional filtering options
     * @returns Unsubscribe function
     */
    subscribe(listener: EventListener, options?: SubscribeOptions): () => void;
    /**
     * Remove all subscribers.
     * Useful for testing or cleanup.
     */
    clear(): void;
    /**
     * Get the number of active subscribers.
     */
    get subscriberCount(): number;
    /**
     * Check if an event should be delivered to a subscriber based on options.
     */
    private shouldDeliver;
}
