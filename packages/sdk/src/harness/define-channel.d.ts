/**
 * defineChannel - Declarative Channel Factory
 *
 * Creates type-safe channels with minimal boilerplate.
 * Channels are bidirectional event consumers that can handle events
 * and optionally send commands back to the harness.
 *
 * Channels can be:
 * - Console renderers (terminal output)
 * - Database writers (persistence)
 * - HTTP/SSE servers (real-time streaming)
 * - Metrics collectors
 * - Any other event consumer
 *
 * @module harness/define-channel
 */
import type { Attachment, BaseEvent, EnrichedEvent, IUnifiedEventBus, Transport } from "../infra/unified-events/types.js";
/**
 * Context passed to event handlers.
 */
export interface ChannelContext<TState> {
    /** Mutable channel state */
    state: TState;
    /** Current event being handled */
    event: EnrichedEvent<BaseEvent>;
    /** Emit custom events back to bus */
    emit: (type: string, data: Record<string, unknown>) => void;
    /** The transport (for bidirectional communication) */
    transport?: Transport;
}
/**
 * Event handler function type.
 */
export type ChannelEventHandler<TState> = (context: ChannelContext<TState>) => void | Promise<void>;
/**
 * Channel definition for defineChannel() factory.
 */
export interface ChannelDefinition<TState> {
    /** Channel name for debugging */
    name: string;
    /** Initial state factory (called fresh on each attach) */
    state?: () => TState;
    /** Event handlers by type pattern */
    on: Record<string, ChannelEventHandler<TState>>;
    /** Called when channel attaches to transport */
    onStart?: (context: ChannelContext<TState>) => void | Promise<void>;
    /** Called when channel detaches from transport */
    onComplete?: (context: ChannelContext<TState>) => void | Promise<void>;
}
/**
 * Channel interface.
 * Channels are Attachments that can be used with harness.attach().
 */
export interface IChannel {
    /** Channel name */
    readonly name: string;
    /** Connect to event bus (legacy API) */
    attach(bus: IUnifiedEventBus): void;
    /** Disconnect from event bus (legacy API) */
    detach(): void;
    /** Get as Attachment for use with harness.attach() */
    toAttachment(): Attachment;
}
/**
 * Create a channel from a declarative definition.
 *
 * Returns an Attachment that can be used directly with harness.attach().
 * Channels are bidirectional event consumers - they can receive events
 * and optionally send commands back to the harness.
 *
 * @param definition - Channel configuration
 * @returns Attachment function for use with harness.attach()
 *
 * @example
 * ```typescript
 * // Database writer channel
 * const dbChannel = defineChannel({
 *   name: 'DatabaseWriter',
 *   state: () => ({ count: 0 }),
 *   on: {
 *     'task:complete': async ({ state, event }) => {
 *       state.count++;
 *       await db.insert('task_logs', event);
 *     },
 *   },
 *   onComplete: async ({ state }) => {
 *     console.log(`Wrote ${state.count} tasks to database`);
 *   },
 * });
 *
 * // Use with harness - no toAttachment() needed!
 * await MyHarness.create()
 *   .attach(dbChannel)
 *   .run();
 * ```
 *
 * @example
 * ```typescript
 * // Console renderer channel
 * const consoleChannel = defineChannel({
 *   name: 'Console',
 *   state: () => ({ output: new RenderOutput() }),
 *   on: {
 *     'task:start': ({ state, event }) => {
 *       state.output.line(`Starting: ${event.event.type}`);
 *     },
 *     'task:complete': ({ state }) => {
 *       state.output.line('✓ Done!');
 *     },
 *   },
 * });
 *
 * await MyHarness.create()
 *   .attach(consoleChannel)
 *   .run();
 * ```
 */
export declare function defineChannel<TState = Record<string, never>>(definition: ChannelDefinition<TState>): Attachment;
/**
 * Create a channel and get the IChannel interface.
 * Use this if you need access to the channel's attach/detach methods
 * for use with legacy IUnifiedEventBus directly.
 *
 * @param definition - Channel configuration
 * @returns IChannel instance
 */
export declare function createChannel<TState = Record<string, never>>(definition: ChannelDefinition<TState>): IChannel;
