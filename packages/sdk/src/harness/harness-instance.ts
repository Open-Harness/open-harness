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

import type { IUnifiedEventBus } from "../core/unified-events/types.js";
import type { AgentConstructor, ExecuteContext, ResolvedAgents } from "../factory/define-harness.js";
import { createParallelHelper, createRetryHelper } from "./control-flow.js";
import type { FluentEventHandler, FluentHarnessEvent, HarnessEventType, PhaseEvent, TaskEvent } from "./event-types.js";

// ============================================================================
// TYPES
// ============================================================================

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
}

// ============================================================================
// HARNESS INSTANCE CLASS
// ============================================================================

/**
 * Running harness instance.
 * Supports chainable event subscription and execution.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for flexible agent typing
export class HarnessInstance<TAgents extends Record<string, AgentConstructor<any>>, TState, TResult> {
	private readonly _name: string;
	private readonly _agents: ResolvedAgents<TAgents>;
	private _state: TState;
	private readonly _runFn: ((context: ExecuteContext<TAgents, TState>, input: unknown) => Promise<TResult>) | undefined;
	private readonly _input: unknown;
	private readonly _unifiedBus: IUnifiedEventBus | undefined;

	private readonly _subscriptions: Subscription[] = [];
	private readonly _events: FluentHarnessEvent[] = [];
	private _completed = false;

	constructor(config: HarnessInstanceConfig<TAgents, TState, unknown, TResult>) {
		this._name = config.name;
		this._agents = config.agents;
		this._state = config.state;
		this._runFn = config.run;
		this._input = config.input;
		this._unifiedBus = config.unifiedBus;
	}

	/**
	 * Access current state (readonly from external perspective).
	 */
	get state(): TState {
		return this._state;
	}

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

			return {
				result,
				state: this._state,
				events: [...this._events],
				duration,
			};
		} finally {
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

		// Deliver to subscribers
		for (const subscription of this._subscriptions) {
			if (this._shouldDeliver(event, subscription.type)) {
				try {
					subscription.handler(event);
				} catch (error) {
					// Event handler errors are non-critical (spec.md:151-155)
					const message = error instanceof Error ? error.message : String(error);
					const eventType = event.type;
					console.error(`[HarnessWarning] ${this._name}: Event handler for "${eventType}" threw: ${message}`);
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
		};
	}
}
