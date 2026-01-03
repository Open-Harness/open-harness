/**
 * Horizon Runtime Wrapper
 *
 * Wraps kernel-v3's createRuntime with Horizon-specific configuration.
 * Provides a higher-level API for the planner/coder/reviewer workflow.
 */

import { readFileSync } from "node:fs";
import {
	createRuntime,
	type FlowDefinition,
	InMemoryRunStore,
	type RunSnapshot,
	type Runtime,
	type RuntimeEvent,
} from "@open-harness/kernel-v3";
import { parse as parseYaml } from "yaml";
import { createHorizonRegistry } from "./node-registry.js";
import {
	type HorizonState,
	HorizonStateSchema,
	horizonStateDefinition,
	INITIAL_STATE,
} from "./state-schema.js";

/**
 * Options for creating a Horizon runtime.
 */
export interface HorizonRuntimeOptions {
	/** Path to the flow YAML file */
	flowPath: string;
	/** Enable persistence for pause/resume across sessions */
	enablePersistence?: boolean;
	/** Resume from a previous run */
	resumeRunId?: string;
}

/**
 * Input for running a Horizon workflow.
 */
export interface HorizonInput {
	/** Feature description to implement */
	feature: string;
	/** Maximum review iterations per task (default: 5) */
	maxReviewIterations?: number;
}

/**
 * Horizon runtime instance.
 * Wraps kernel-v3 Runtime with typed state access.
 */
export interface HorizonRuntime {
	/** Underlying kernel-v3 runtime */
	readonly runtime: Runtime;

	/** Run the workflow */
	run(input: HorizonInput): Promise<RunSnapshot>;

	/** Dispatch a command to the runtime */
	dispatch(command: Parameters<Runtime["dispatch"]>[0]): void;

	/** Subscribe to runtime events */
	onEvent(listener: (event: RuntimeEvent) => void): () => void;

	/** Get current snapshot */
	getSnapshot(): RunSnapshot;

	/** Get typed Horizon state from snapshot */
	getState(): HorizonState;

	/** Pause the workflow (resumable) */
	pause(): void;

	/** Resume the workflow */
	resume(message?: string): void;

	/** Abort the workflow (not resumable) */
	abort(): void;
}

/**
 * Create a Horizon runtime instance.
 *
 * @param options - Runtime options
 * @returns Horizon runtime
 */
export function createHorizonRuntime(options: HorizonRuntimeOptions): HorizonRuntime {
	// Load and parse flow definition
	const yamlContent = readFileSync(options.flowPath, "utf-8");
	const parsed = parseYaml(yamlContent) as Record<string, unknown>;

	// Convert YAML structure to FlowDefinition
	const flow = parseFlowYaml(parsed);

	// Create registry with Horizon nodes
	const registry = createHorizonRegistry();

	// Create optional persistence store
	const store = options.enablePersistence ? new InMemoryRunStore() : undefined;

	// Create kernel-v3 runtime
	const runtime = createRuntime({
		flow,
		registry,
		store,
		resume: options.resumeRunId ? { runId: options.resumeRunId } : undefined,
	});

	return {
		runtime,

		run(input: HorizonInput): Promise<RunSnapshot> {
			return runtime.run({
				feature: input.feature,
				maxReviewIterations: input.maxReviewIterations ?? 5,
			});
		},

		dispatch(command) {
			runtime.dispatch(command);
		},

		onEvent(listener) {
			return runtime.onEvent(listener);
		},

		getSnapshot() {
			return runtime.getSnapshot();
		},

		getState(): HorizonState {
			const snapshot = runtime.getSnapshot();
			// Validate state at runtime to catch kernel-v3 inconsistencies
			const result = HorizonStateSchema.safeParse(snapshot.state);
			if (result.success) {
				return result.data;
			}
			// Fallback to initial state if validation fails (shouldn't happen in normal operation)
			console.warn("HorizonRuntime: State validation failed, using INITIAL_STATE", result.error.issues);
			return INITIAL_STATE;
		},

		pause() {
			runtime.dispatch({ type: "abort", resumable: true });
		},

		resume(message?: string) {
			runtime.dispatch({ type: "resume", message });
		},

		abort() {
			runtime.dispatch({ type: "abort", resumable: false });
		},
	};
}

/**
 * Parse YAML flow structure into FlowDefinition.
 * Handles both top-level and nested YAML formats.
 */
function parseFlowYaml(parsed: Record<string, unknown>): FlowDefinition {
	// Handle flow: { name, ... } wrapper
	const flowData =
		"flow" in parsed && parsed.flow && typeof parsed.flow === "object"
			? (parsed.flow as Record<string, unknown>)
			: parsed;

	const name = (flowData.name as string) ?? "horizon-agent";
	const version = flowData.version as number | undefined;

	// Parse state with defaults from horizonStateDefinition
	const stateData = flowData.state as { initial: Record<string, unknown> } | undefined;
	const state = stateData ?? horizonStateDefinition;

	// Parse nodes
	const nodesData =
		(parsed.nodes as Array<Record<string, unknown>>) ?? (flowData.nodes as Array<Record<string, unknown>>) ?? [];

	const nodes = nodesData.map((node) => ({
		id: node.id as string,
		type: node.type as string,
		input: (node.input as Record<string, unknown>) ?? {},
		when: node.when as FlowDefinition["nodes"][0]["when"],
		policy: node.policy as FlowDefinition["nodes"][0]["policy"],
		ui: node.ui as FlowDefinition["nodes"][0]["ui"],
	}));

	// Parse edges
	const edgesData =
		(parsed.edges as Array<Record<string, unknown>>) ?? (flowData.edges as Array<Record<string, unknown>>) ?? [];

	const edges = edgesData.map((edge) => ({
		id: edge.id as string | undefined,
		from: edge.from as string,
		to: edge.to as string,
		when: edge.when as FlowDefinition["edges"][0]["when"],
		gate: edge.gate as FlowDefinition["edges"][0]["gate"],
		forEach: edge.forEach as FlowDefinition["edges"][0]["forEach"],
		maxIterations: edge.maxIterations as number | undefined,
	}));

	return {
		name,
		version,
		state,
		nodes,
		edges,
	};
}
