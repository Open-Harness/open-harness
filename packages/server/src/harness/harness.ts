import { createClaudeNode } from "@internal/providers-claude";
import { type Transport, WebSocketTransport } from "@internal/transports-websocket";
import type {
	FlowDefinition,
	NodeRegistry,
	NodeTypeDefinition,
	RunSnapshot,
	RunStore,
	Runtime,
	RuntimeEvent,
} from "@open-harness/core";
import { createRuntime, DefaultNodeRegistry } from "@open-harness/core";
import { constantNode, echoNode } from "../nodes/index.js";

/**
 * Options for creating a harness.
 */
export interface HarnessOptions {
	/** Flow definition to run. */
	flow: FlowDefinition;
	/** Optional node registry (NodeRegistry or plain object of nodes). */
	registry?: NodeRegistry | Record<string, NodeTypeDefinition<unknown, unknown>>;
	/** Optional persistence store. */
	store?: RunStore;
	/** Optional transport configuration. */
	transport?: {
		/** WebSocket transport options. */
		websocket?: { port: number; path?: string };
	};
	/** Optional event handler. */
	onEvent?: (event: RuntimeEvent) => void;
}

/**
 * Harness interface - manages wiring and execution.
 */
export interface Harness {
	/** Run the flow with optional input. */
	run(input?: Record<string, unknown>): Promise<RunSnapshot>;
	/** Runtime instance for advanced control. */
	runtime: Runtime;
	/** Optional transport instance. */
	transport?: Transport;
	/** Stop the harness and transport. */
	stop(): Promise<void>;
}

/**
 * Normalize registry input - accepts NodeRegistry or plain object of nodes.
 */
function normalizeRegistry(
	registry?: NodeRegistry | Record<string, NodeTypeDefinition<unknown, unknown>>,
): NodeRegistry | undefined {
	if (!registry) return undefined;
	if ("register" in registry && "get" in registry) {
		return registry as NodeRegistry;
	}

	// Convert plain object to NodeRegistry
	const nodeRegistry = new DefaultNodeRegistry();
	for (const node of Object.values(registry)) {
		nodeRegistry.register(node);
	}
	return nodeRegistry;
}

/**
 * Create a harness with smart defaults and automatic wiring.
 */
export function createHarness(options: HarnessOptions): Harness {
	const registry = normalizeRegistry(options.registry) ?? createDefaultRegistry();
	const runtime = createRuntime({
		flow: options.flow,
		registry,
		store: options.store,
	});

	let transport: Transport | undefined;
	let unsbs: (() => void) | undefined;

	if (options.onEvent) {
		unsbs = runtime.onEvent(options.onEvent);
	}

	if (options.transport?.websocket) {
		transport = new WebSocketTransport(runtime, options.transport.websocket);
	}

	return {
		async run(input) {
			if (transport) {
				await transport.start();
			}
			return runtime.run(input);
		},
		runtime,
		transport,
		async stop() {
			if (unsbs) {
				unsbs();
				unsbs = undefined;
			}
			if (transport) {
				await transport.stop();
			}
		},
	};
}

/**
 * Options for the runflow convenience function.
 */
export interface RunFlowOptions {
	/** Flow definition to run. */
	flow: FlowDefinition;
	/** Optional input for the flow. */
	input?: Record<string, unknown>;
	/** Optional node registry (NodeRegistry or plain object of nodes). */
	registry?: NodeRegistry | Record<string, NodeTypeDefinition<unknown, unknown>>;
	/** Optional persistence store. */
	store?: RunStore;
	/** Optional transport configuration. */
	transport?: {
		/** WebSocket transport options. */
		websocket?: { port: number; path?: string };
	};
	/** Optional event handler. */
	onEvent?: (event: RuntimeEvent) => void;
}

/**
 * Run a flow with automatic cleanup - simplest possible API.
 */
export async function runFlow(options: RunFlowOptions): Promise<RunSnapshot> {
	const harness = createHarness(options);

	try {
		return await harness.run(options.input);
	} finally {
		await harness.stop();
	}
}

/**
 * Create a default registry with all standard node types.
 */
export function createDefaultRegistry(): NodeRegistry {
	const registry = new DefaultNodeRegistry();
	registerStandardNodes(registry);
	return registry;
}

/**
 * Register all standard node types to a registry.
 */
export function registerStandardNodes(registry: NodeRegistry): void {
	registry.register(createClaudeNode() as NodeTypeDefinition<unknown, unknown>);
	registry.register(constantNode as NodeTypeDefinition<unknown, unknown>);
	registry.register(echoNode as NodeTypeDefinition<unknown, unknown>);
}
