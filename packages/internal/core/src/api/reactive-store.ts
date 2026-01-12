/**
 * Reactive Store - State that automatically emits signals on change.
 *
 * Creates a Proxy-wrapped state object that emits `state:X:changed` signals
 * whenever properties are modified. This enables reactive agent activation
 * based on state changes.
 *
 * @example
 * ```ts
 * import { createReactiveStore } from "@open-harness/core"
 *
 * const { state, subscribe } = createReactiveStore({
 *   confidence: 0,
 *   position: null,
 * })
 *
 * // Subscribe to state changes
 * subscribe((signal) => {
 *   console.log(signal.name) // "state:confidence:changed"
 *   console.log(signal.payload) // { key: "confidence", oldValue: 0, newValue: 0.85 }
 * })
 *
 * // Mutations emit signals automatically
 * state.confidence = 0.85  // Emits state:confidence:changed
 * state.position = "long"  // Emits state:position:changed
 * ```
 */

import { createSignal, type Signal, type SignalSource } from "@internal/signals-core";

// ============================================================================
// Types
// ============================================================================

/**
 * Payload emitted when a state property changes.
 */
export type StateChangePayload<T = unknown> = {
	/** The property key that changed */
	key: string;
	/** Previous value */
	oldValue: T;
	/** New value */
	newValue: T;
	/** Full path for nested properties (e.g., "user.settings.theme") */
	path: string;
};

/**
 * Handler for state change signals.
 */
export type StateChangeHandler = (signal: Signal<StateChangePayload>) => void;

/**
 * A reactive store that emits signals on state changes.
 */
export type ReactiveStore<T extends Record<string, unknown>> = {
	/**
	 * The reactive state object.
	 * Mutations to this object emit signals.
	 */
	state: T;

	/**
	 * Subscribe to state change signals.
	 * Returns an unsubscribe function.
	 */
	subscribe: (handler: StateChangeHandler) => () => void;

	/**
	 * Get a readonly snapshot of current state.
	 */
	getSnapshot: () => Readonly<T>;

	/**
	 * Get all signals emitted since store creation.
	 */
	history: () => readonly Signal<StateChangePayload>[];

	/**
	 * Batch multiple state changes into a single signal.
	 * Useful for atomic updates.
	 */
	batch: (updater: (state: T) => void) => void;
};

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create a reactive store that emits signals on state changes.
 *
 * @param initialState - Initial state object
 * @param source - Optional source metadata for emitted signals
 * @returns ReactiveStore with state proxy and subscription methods
 *
 * @example
 * ```ts
 * const store = createReactiveStore({
 *   count: 0,
 *   user: { name: "Alice" },
 * })
 *
 * store.subscribe((signal) => {
 *   console.log(`${signal.name}: ${signal.payload.newValue}`)
 * })
 *
 * store.state.count = 1  // Logs: "state:count:changed: 1"
 * store.state.user.name = "Bob"  // Logs: "state:user.name:changed: Bob"
 * ```
 */
export function createReactiveStore<T extends Record<string, unknown>>(
	initialState: T,
	source?: Omit<SignalSource, "parent">,
): ReactiveStore<T> {
	// Handlers for state change signals
	const handlers = new Set<StateChangeHandler>();

	// History of all emitted signals
	const signalHistory: Signal<StateChangePayload>[] = [];

	// Batching state
	let isBatching = false;
	const batchedChanges: StateChangePayload[] = [];

	/**
	 * Emit a state change signal to all subscribers.
	 */
	function emitChange(payload: StateChangePayload): void {
		if (isBatching) {
			batchedChanges.push(payload);
			return;
		}

		const signal = createSignal<StateChangePayload>(
			`state:${payload.path}:changed`,
			payload,
			source,
		);

		signalHistory.push(signal);

		for (const handler of handlers) {
			handler(signal);
		}
	}

	/**
	 * Create a reactive proxy for an object.
	 * Handles nested objects by recursively wrapping them.
	 */
	function createProxy<O extends Record<string, unknown>>(
		obj: O,
		parentPath: string = "",
	): O {
		return new Proxy(obj, {
			get(target, prop: string) {
				const value = target[prop];

				// Recursively wrap nested objects
				if (value !== null && typeof value === "object" && !Array.isArray(value)) {
					const path = parentPath ? `${parentPath}.${prop}` : prop;
					return createProxy(value as Record<string, unknown>, path);
				}

				return value;
			},

			set(target, prop: string, newValue) {
				const oldValue = target[prop];

				// Don't emit if value hasn't changed
				if (oldValue === newValue) {
					return true;
				}

				// Update the value
				(target as Record<string, unknown>)[prop] = newValue;

				// Build the path
				const path = parentPath ? `${parentPath}.${prop}` : prop;

				// Emit the change signal
				emitChange({
					key: prop,
					oldValue,
					newValue,
					path,
				});

				return true;
			},
		});
	}

	// Create the deep copy of initial state and wrap in proxy
	const stateCopy = JSON.parse(JSON.stringify(initialState)) as T;
	const reactiveState = createProxy(stateCopy);

	return {
		state: reactiveState,

		subscribe(handler: StateChangeHandler): () => void {
			handlers.add(handler);
			return () => handlers.delete(handler);
		},

		getSnapshot(): Readonly<T> {
			return JSON.parse(JSON.stringify(stateCopy)) as T;
		},

		history(): readonly Signal<StateChangePayload>[] {
			return signalHistory;
		},

		batch(updater: (state: T) => void): void {
			isBatching = true;
			batchedChanges.length = 0;

			try {
				updater(reactiveState);
			} finally {
				isBatching = false;
			}

			// Emit a single batch signal if there were changes
			if (batchedChanges.length > 0) {
				const signal = createSignal<StateChangePayload>(
					"state:batch:changed",
					{
						key: "batch",
						oldValue: null,
						newValue: batchedChanges.map((c) => ({
							path: c.path,
							newValue: c.newValue,
						})),
						path: "batch",
					},
					source,
				);

				signalHistory.push(signal);

				for (const handler of handlers) {
					handler(signal);
				}
			}
		},
	};
}

/**
 * Connect a reactive store to a SignalBus.
 *
 * All state changes will be emitted to the bus, allowing agents
 * to subscribe to `state:*:changed` patterns.
 *
 * @param store - The reactive store
 * @param bus - SignalBus to emit to
 * @returns Unsubscribe function
 */
export function connectStoreToBus<T extends Record<string, unknown>>(
	store: ReactiveStore<T>,
	bus: { emit: (signal: Signal) => void },
): () => void {
	return store.subscribe((signal) => {
		bus.emit(signal);
	});
}
