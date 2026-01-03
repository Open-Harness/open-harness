import type {
	RuntimeCommand,
	RuntimeEvent,
	RuntimeEventListener,
} from "../core/events.js";
import type { FlowDefinition } from "../core/types.js";
import type { RunStore } from "../persistence/run-store.js";
import type { NodeRegistry } from "../registry/registry.js";
import type { RunSnapshot } from "./snapshot.js";

/**
 * Event bus abstraction used by the runtime.
 */
export interface EventBus {
	/**
	 * Emit an event to all subscribers.
	 * @param event - Event payload.
	 */
	emit(event: RuntimeEvent): void;
	/**
	 * Subscribe to events.
	 * @param listener - Event listener.
	 * @returns Unsubscribe function.
	 */
	subscribe(listener: RuntimeEventListener): () => void;
}

/**
 * Public runtime API.
 */
export interface Runtime {
	/**
	 * Execute the flow to completion or pause.
	 * @param input - Optional input overrides.
	 * @returns Final run snapshot.
	 */
	run(input?: Record<string, unknown>): Promise<RunSnapshot>;
	/**
	 * Dispatch a command into the runtime.
	 * @param command - Command to dispatch.
	 */
	dispatch(command: RuntimeCommand): void;
	/**
	 * Subscribe to runtime events.
	 * @param listener - Event listener.
	 * @returns Unsubscribe function.
	 */
	onEvent(listener: RuntimeEventListener): () => void;
	/**
	 * Return a current snapshot of runtime state.
	 * @returns Run snapshot.
	 */
	getSnapshot(): RunSnapshot;
}

/**
 * Options for creating a runtime instance.
 *
 * @property {FlowDefinition} flow - Flow definition.
 * @property {NodeRegistry} registry - Node registry.
 * @property {RunStore} [store] - Optional persistence store.
 */
export interface RuntimeOptions {
	flow: FlowDefinition;
	registry: NodeRegistry;
	store?: RunStore;
}

/**
 * Create a new runtime instance.
 *
 * @param options - Runtime construction options.
 * @returns Runtime instance.
 */
export declare function createRuntime(options: RuntimeOptions): Runtime;
