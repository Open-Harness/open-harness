import type { RuntimeCommand, RuntimeEvent, RuntimeEventListener } from "../core/events.js";
import type { FlowDefinition } from "../core/types.js";
import type { RunStore } from "../persistence/run-store.js";
import type { NodeRegistry } from "../registry/registry.js";
import type { RunSnapshot } from "./snapshot.js";

export interface EventBus {
	emit(event: RuntimeEvent): void;
	subscribe(listener: RuntimeEventListener): () => void;
}

export interface Runtime {
	run(input?: Record<string, unknown>): Promise<RunSnapshot>;
	dispatch(command: RuntimeCommand): void;
	onEvent(listener: RuntimeEventListener): () => void;
	getSnapshot(): RunSnapshot;
}

export interface RuntimeOptions {
	flow: FlowDefinition;
	registry: NodeRegistry;
	store?: RunStore;
}

export declare function createRuntime(options: RuntimeOptions): Runtime;
