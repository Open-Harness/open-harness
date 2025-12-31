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

import { matchesFilter } from "../core/unified-events/filter.js";
import type {
	Attachment,
	BaseEvent,
	EnrichedEvent,
	IUnifiedEventBus,
	Transport,
	Unsubscribe,
} from "../core/unified-events/types.js";
import { RenderOutput } from "./render-output.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Channel configuration.
 */
export interface ChannelConfig {
	/** Verbosity level */
	verbosity: "minimal" | "normal" | "verbose";
	/** Enable colors in output */
	colors: boolean;
	/** Enable Unicode symbols */
	unicode: boolean;
}

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
	/** Channel configuration */
	config: ChannelConfig;
	/** Terminal output helpers (for console channels) */
	output: RenderOutput;
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

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_CONFIG: ChannelConfig = {
	verbosity: "normal",
	colors: true,
	unicode: true,
};

// ============================================================================
// CHANNEL CLASS
// ============================================================================

/**
 * Channel - Internal implementation of IChannel.
 *
 * Created by defineChannel() factory. Handles:
 * - Event subscription with pattern matching
 * - State management (fresh on each attach)
 * - Lifecycle hooks (onStart/onComplete)
 * - Bidirectional communication via transport
 */
class Channel<TState> implements IChannel {
	readonly name: string;

	private definition: ChannelDefinition<TState>;
	private bus: IUnifiedEventBus | null = null;
	private unsubscribe: Unsubscribe | null = null;
	private channelState: TState;
	private config: ChannelConfig;
	private output: RenderOutput;
	private currentTransport: Transport | undefined;

	constructor(definition: ChannelDefinition<TState>, config?: Partial<ChannelConfig>) {
		this.name = definition.name;
		this.definition = definition;
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.output = new RenderOutput({
			colors: this.config.colors,
			unicode: this.config.unicode,
		});
		// Initialize with empty state - factory is called on attach()
		this.channelState = {} as TState;
	}

	/**
	 * Attach channel to event bus (legacy API).
	 *
	 * - Creates fresh state from factory
	 * - Subscribes to all events
	 * - Calls onStart hook
	 */
	attach(bus: IUnifiedEventBus): void {
		if (this.bus) {
			throw new Error(`Channel "${this.name}" is already attached to a bus`);
		}

		this.bus = bus;

		// Fresh state on attach
		this.channelState = this.definition.state?.() ?? ({} as TState);

		// Create render output with current config
		this.output = new RenderOutput({
			colors: this.config.colors,
			unicode: this.config.unicode,
		});

		// Subscribe to all events
		this.unsubscribe = bus.subscribe((event) => {
			this.handleEvent(event);
		});

		// Call onStart hook if defined
		if (this.definition.onStart) {
			const context = this.createContext(this.createEmptyEvent());
			this.definition.onStart(context);
		}
	}

	/**
	 * Detach channel from event bus (legacy API).
	 *
	 * - Calls onComplete hook
	 * - Unsubscribes from events
	 * - Clears bus reference
	 */
	detach(): void {
		if (!this.bus) {
			return; // Already detached
		}

		// Call onComplete hook if defined
		if (this.definition.onComplete) {
			const context = this.createContext(this.createEmptyEvent());
			this.definition.onComplete(context);
		}

		// Unsubscribe
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}

		this.bus = null;
		this.currentTransport = undefined;
	}

	/**
	 * Convert to Attachment for use with harness.attach().
	 * This is the preferred API.
	 */
	toAttachment(): Attachment {
		return (transport: Transport) => {
			const subscriptions: Unsubscribe[] = [];
			let attached = false;
			let subscriberCount = 0;

			// Store transport for bidirectional communication
			this.currentTransport = transport;

			// Wrap transport events as EnrichedEvent
			const wrapAsEnrichedEvent = (event: {
				type: string;
				timestamp?: Date;
				[key: string]: unknown;
			}): EnrichedEvent => ({
				id: crypto.randomUUID(),
				timestamp: event.timestamp ?? new Date(),
				context: { sessionId: "" },
				event: event as BaseEvent,
			});

			// Create a proxy that looks like IUnifiedEventBus but uses transport.subscribe
			const busProxy: IUnifiedEventBus = {
				emit: () => {
					// Channels can emit but we don't forward to transport
				},
				subscribe: (filterOrListener: unknown, maybeListener?: unknown): Unsubscribe => {
					let unifiedListener: (event: EnrichedEvent) => void;
					if (typeof filterOrListener === "function") {
						unifiedListener = filterOrListener as (event: EnrichedEvent) => void;
					} else if (typeof maybeListener === "function") {
						unifiedListener = maybeListener as (event: EnrichedEvent) => void;
					} else {
						return () => {};
					}

					const unsub = transport.subscribe((rawEvent) => {
						const event = rawEvent as unknown as { type: string; timestamp?: Date; [key: string]: unknown };
						const enriched = wrapAsEnrichedEvent(event);
						unifiedListener(enriched);
					});
					subscriptions.push(unsub);
					subscriberCount++;

					return () => {
						unsub();
						subscriberCount--;
					};
				},
				scoped: <T>(_: unknown, fn: () => T | Promise<T>) => fn(),
				current: () => ({ sessionId: "" }),
				clear: () => {
					for (const unsub of subscriptions) {
						unsub();
					}
					subscriptions.length = 0;
					subscriberCount = 0;
				},
				get subscriberCount() {
					return subscriberCount;
				},
			};

			// Attach to proxy bus
			this.attach(busProxy);
			attached = true;

			// Return cleanup function
			return () => {
				if (attached) {
					this.detach();
					attached = false;
				}
				for (const unsub of subscriptions) {
					unsub();
				}
			};
		};
	}

	/**
	 * Handle incoming event by matching against handler patterns.
	 */
	private handleEvent(event: EnrichedEvent<BaseEvent>): void {
		const context = this.createContext(event);

		for (const [pattern, handler] of Object.entries(this.definition.on)) {
			if (matchesFilter(event.event.type, pattern)) {
				try {
					handler(context);
				} catch (_error) {
					// Handler errors are non-critical - silently continue
				}
			}
		}
	}

	/**
	 * Create channel context for handlers.
	 */
	private createContext(event: EnrichedEvent<BaseEvent>): ChannelContext<TState> {
		return {
			state: this.channelState,
			event,
			emit: (type: string, data: Record<string, unknown>) => {
				if (this.bus) {
					this.bus.emit({ type, ...data } as BaseEvent);
				}
			},
			config: this.config,
			output: this.output,
			transport: this.currentTransport,
		};
	}

	/**
	 * Create a minimal event for lifecycle hooks.
	 */
	private createEmptyEvent(): EnrichedEvent<BaseEvent> {
		return {
			id: "",
			timestamp: new Date(),
			context: { sessionId: this.bus?.current().sessionId ?? "" },
			event: { type: "lifecycle:internal" } as BaseEvent,
		};
	}
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a channel from a declarative definition.
 *
 * Returns an Attachment that can be used directly with harness.attach().
 * Channels are bidirectional event consumers - they can receive events
 * and optionally send commands back to the harness.
 *
 * @param definition - Channel configuration
 * @param config - Optional channel config overrides
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
 *   on: {
 *     'task:start': ({ event, output }) => {
 *       output.line(`Starting: ${event.event.type}`);
 *     },
 *     'task:complete': ({ output }) => {
 *       output.success('Done!');
 *     },
 *   },
 * });
 *
 * await MyHarness.create()
 *   .attach(consoleChannel)
 *   .run();
 * ```
 */
export function defineChannel<TState = Record<string, never>>(
	definition: ChannelDefinition<TState>,
	config?: Partial<ChannelConfig>,
): Attachment {
	const channel = new Channel(definition, config);
	return channel.toAttachment();
}

/**
 * Create a channel and get the IChannel interface.
 * Use this if you need access to the channel's attach/detach methods
 * for use with legacy IUnifiedEventBus directly.
 *
 * @param definition - Channel configuration
 * @param config - Optional channel config overrides
 * @returns IChannel instance
 */
export function createChannel<TState = Record<string, never>>(
	definition: ChannelDefinition<TState>,
	config?: Partial<ChannelConfig>,
): IChannel {
	return new Channel(definition, config);
}
