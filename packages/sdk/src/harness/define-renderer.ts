/**
 * defineRenderer - Declarative Renderer Factory
 *
 * Creates type-safe renderers with minimal boilerplate.
 * Renderers subscribe to UnifiedEventBus and handle events declaratively.
 *
 * @module harness/define-renderer
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
 * Renderer configuration.
 */
export interface RendererConfig {
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
export interface RenderContext<TState> {
	/** Mutable renderer state */
	state: TState;
	/** Current event being handled */
	event: EnrichedEvent<BaseEvent>;
	/** Emit custom events back to bus */
	emit: (type: string, data: Record<string, unknown>) => void;
	/** Renderer configuration */
	config: RendererConfig;
	/** Terminal output helpers */
	output: RenderOutput;
}

/**
 * Event handler function type.
 */
export type EventHandler<TState> = (context: RenderContext<TState>) => void | Promise<void>;

/**
 * Renderer definition for defineRenderer() factory.
 */
export interface RendererDefinition<TState> {
	/** Renderer name for debugging */
	name: string;
	/** Initial state factory (called fresh on each attach) */
	state?: () => TState;
	/** Event handlers by type pattern */
	on: Record<string, EventHandler<TState>>;
	/** Called when renderer attaches to bus */
	onStart?: (context: RenderContext<TState>) => void | Promise<void>;
	/** Called when renderer detaches from bus */
	onComplete?: (context: RenderContext<TState>) => void | Promise<void>;
}

/**
 * Unified renderer interface.
 */
export interface IUnifiedRenderer {
	/** Renderer name */
	readonly name: string;
	/** Connect to event bus */
	attach(bus: IUnifiedEventBus): void;
	/** Disconnect from event bus */
	detach(): void;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_CONFIG: RendererConfig = {
	verbosity: "normal",
	colors: true,
	unicode: true,
};

// ============================================================================
// UNIFIED RENDERER CLASS
// ============================================================================

/**
 * UnifiedRenderer - Internal implementation of IUnifiedRenderer.
 *
 * Created by defineRenderer() factory. Handles:
 * - Event subscription with pattern matching
 * - State management (fresh on each attach)
 * - Lifecycle hooks (onStart/onComplete)
 */
class UnifiedRenderer<TState> implements IUnifiedRenderer {
	readonly name: string;

	private definition: RendererDefinition<TState>;
	private bus: IUnifiedEventBus | null = null;
	private unsubscribe: Unsubscribe | null = null;
	private state: TState;
	private config: RendererConfig;
	private output: RenderOutput;

	constructor(definition: RendererDefinition<TState>, config?: Partial<RendererConfig>) {
		this.name = definition.name;
		this.definition = definition;
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.output = new RenderOutput({
			colors: this.config.colors,
			unicode: this.config.unicode,
		});
		// Initialize with empty state - factory is called on attach()
		this.state = {} as TState;
	}

	/**
	 * Attach renderer to event bus.
	 *
	 * - Creates fresh state from factory
	 * - Subscribes to all events
	 * - Calls onStart hook
	 */
	attach(bus: IUnifiedEventBus): void {
		if (this.bus) {
			throw new Error(`Renderer "${this.name}" is already attached to a bus`);
		}

		this.bus = bus;

		// Fresh state on attach
		this.state = this.definition.state?.() ?? ({} as TState);

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
	 * Detach renderer from event bus.
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
	}

	/**
	 * Handle incoming event by matching against handler patterns.
	 */
	private handleEvent(event: EnrichedEvent<BaseEvent>): void {
		const context = this.createContext(event);

		// Find matching handlers
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
	 * Create render context for handlers.
	 */
	private createContext(event: EnrichedEvent<BaseEvent>): RenderContext<TState> {
		return {
			state: this.state,
			event,
			emit: (type: string, data: Record<string, unknown>) => {
				if (this.bus) {
					this.bus.emit({ type, ...data } as BaseEvent);
				}
			},
			config: this.config,
			output: this.output,
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
 * Create a renderer from a declarative definition.
 *
 * Provides a clean, minimal-boilerplate way to build renderers:
 * - Type-safe state management
 * - Pattern-based event handling
 * - Lifecycle hooks (onStart/onComplete)
 *
 * @param definition - Renderer configuration
 * @param config - Optional renderer config overrides
 * @returns IUnifiedRenderer instance
 *
 * @example
 * ```typescript
 * const myRenderer = defineRenderer({
 *   name: 'ConsoleLogger',
 *   state: () => ({ taskCount: 0 }),
 *   on: {
 *     'task:start': ({ state, event, output }) => {
 *       state.taskCount++;
 *       output.line(`▶ Task ${event.context.task?.id}`);
 *     },
 *     'task:complete': ({ output }) => {
 *       output.line('✓ Done');
 *     },
 *     'agent:*': ({ event, output }) => {
 *       // Handle all agent events
 *       output.line(`  [agent] ${event.event.type}`);
 *     },
 *   },
 *   onComplete: ({ state, output }) => {
 *     output.line(`Total tasks: ${state.taskCount}`);
 *   },
 * });
 *
 * // Attach to event bus
 * const bus = new UnifiedEventBus();
 * myRenderer.attach(bus);
 *
 * // Later: detach
 * myRenderer.detach();
 * ```
 */
export function defineRenderer<TState = Record<string, never>>(
	definition: RendererDefinition<TState>,
	config?: Partial<RendererConfig>,
): IUnifiedRenderer {
	return new UnifiedRenderer(definition, config);
}

// ============================================================================
// ATTACHMENT ADAPTER (T021 - Transport Architecture)
// ============================================================================

/**
 * Convert an IUnifiedRenderer to an Attachment for use with Transport.attach().
 *
 * This adapter allows existing renderers to work with the new Transport architecture.
 * The renderer subscribes to all events via transport.subscribe() and returns a cleanup
 * function that will be called when the harness completes.
 *
 * @param renderer - An IUnifiedRenderer instance
 * @returns Attachment function compatible with Transport.attach()
 *
 * @example
 * ```typescript
 * const renderer = defineRenderer({
 *   name: 'Console',
 *   on: { '*': ({ event }) => console.log(event) }
 * });
 *
 * harness.attach(toAttachment(renderer)).run();
 * ```
 */
export function toAttachment(renderer: IUnifiedRenderer): Attachment {
	return (transport: Transport) => {
		// Create a minimal event bus adapter that forwards transport events
		const subscriptions: Unsubscribe[] = [];
		let attached = false;
		let subscriberCount = 0;

		// Wrap transport events as EnrichedEvent for the unified bus interface
		const wrapAsEnrichedEvent = (event: { type: string; timestamp?: Date; [key: string]: unknown }): EnrichedEvent => ({
			id: crypto.randomUUID(),
			timestamp: event.timestamp ?? new Date(),
			context: { sessionId: "" },
			event: event as BaseEvent,
		});

		// Create a proxy that looks like IUnifiedEventBus but uses transport.subscribe
		// This adapts the Transport interface to what IUnifiedRenderer.attach() expects
		const busProxy: IUnifiedEventBus = {
			emit: () => {
				// Renderers can emit but we don't forward to transport (renderers are consumers)
			},
			subscribe: (filterOrListener: unknown, maybeListener?: unknown): Unsubscribe => {
				// Handle both overloads: subscribe(listener) and subscribe(filter, listener)
				let unifiedListener: (event: EnrichedEvent) => void;
				if (typeof filterOrListener === "function") {
					unifiedListener = filterOrListener as (event: EnrichedEvent) => void;
				} else if (typeof maybeListener === "function") {
					// Filter is ignored for simplicity - renderer gets all events
					unifiedListener = maybeListener as (event: EnrichedEvent) => void;
				} else {
					// Invalid call - return no-op
					return () => {
						// No-op unsubscribe
					};
				}

				// Subscribe to transport and wrap events
				const unsub = transport.subscribe((rawEvent) => {
					// Transport events are FluentHarnessEvent, wrap as EnrichedEvent
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
			scoped: <T>(_: unknown, fn: () => T | Promise<T>) => fn(), // No scoping in this adapter
			current: () => ({ sessionId: "" }), // Minimal context
			clear: () => {
				// Clear all subscriptions
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

		// Attach renderer to our proxy bus
		renderer.attach(busProxy);
		attached = true;

		// Return cleanup function
		return () => {
			if (attached) {
				renderer.detach();
				attached = false;
			}
			// Unsubscribe all
			for (const unsub of subscriptions) {
				unsub();
			}
		};
	};
}
