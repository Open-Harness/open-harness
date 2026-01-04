/**
 * High-level Flow API for kernel-v3.
 *
 * Provides a simple way to create flow runtimes with sensible defaults.
 * No builder pattern - just a config object.
 *
 * @example Simple usage
 * ```ts
 * const runtime = await createFlow('./agent-loop.yaml');
 * await runtime.run({ feature: "Build login" });
 * ```
 *
 * @example With typed state
 * ```ts
 * const runtime = await createFlow<HorizonState>('./agent-loop.yaml', {
 *   stateSchema: HorizonStateSchema,
 * });
 * const state: HorizonState = runtime.getState();
 * ```
 *
 * @example Full options
 * ```ts
 * const runtime = await createFlow('./agent-loop.yaml', {
 *   stateSchema: HorizonStateSchema,
 *   persistence: true,
 *   nodes: [customNode],
 *   resume: { runId: 'abc-123' },
 * });
 * ```
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { RuntimeCommand, RuntimeEvent } from "../core/events.js";
import type { FlowDefinition } from "../core/types.js";
import { FlowDefinitionSchema } from "../core/types.js";
import { builtinNodes } from "../nodes/index.js";
import { InMemoryRunStore } from "../persistence/memory-run-store.js";
import type { RunStore } from "../persistence/run-store.js";
import type { NodeRegistry, NodeTypeDefinition } from "../registry/registry.js";
import { DefaultNodeRegistry } from "../registry/registry.js";
import {
	createRuntime,
	type Runtime,
	type RuntimeResumeOptions,
} from "../runtime/runtime.js";
import type { RunSnapshot } from "../runtime/snapshot.js";

// ============================================================
// TYPED RUNTIME - Runtime with typed state + convenience methods
// ============================================================

/**
 * Runtime with typed state access and convenience methods.
 *
 * Extends the base Runtime interface with:
 * - Type-safe `getState()` returning TState
 * - `pause()`, `resume()`, `abort()` convenience methods
 */
export interface TypedRuntime<TState = Record<string, unknown>> extends Omit<Runtime, "run"> {
	/**
	 * Execute the flow to completion or pause.
	 */
	run(input?: Record<string, unknown>): Promise<RunSnapshot>;

	/** Get typed state from the current snapshot */
	getState(): TState;

	/** Get snapshot with typed state */
	getSnapshot(): RunSnapshot & { state: TState };

	/** Pause the flow (resumable) */
	pause(): void;

	/** Resume a paused flow, optionally injecting a message */
	resume(message?: string): void;

	/** Abort the flow (not resumable) */
	abort(): void;
}

/**
 * Wrap a runtime with typed state access and convenience methods.
 */
function createTypedRuntime<TState>(
	runtime: Runtime,
	schema?: ZodSchema<TState>,
): TypedRuntime<TState> {
	return {
		run: runtime.run.bind(runtime),
		dispatch: runtime.dispatch.bind(runtime),
		onEvent: runtime.onEvent.bind(runtime),

		getSnapshot(): RunSnapshot & { state: TState } {
			return runtime.getSnapshot() as RunSnapshot & { state: TState };
		},

		getState(): TState {
			const snapshot = runtime.getSnapshot();
			if (schema) {
				return schema.parse(snapshot.state);
			}
			return snapshot.state as TState;
		},

		pause(): void {
			runtime.dispatch({ type: "abort", resumable: true });
		},

		resume(message?: string): void {
			runtime.dispatch({ type: "resume", message });
		},

		abort(): void {
			runtime.dispatch({ type: "abort", resumable: false });
		},
	};
}

// ============================================================
// CREATE FLOW - Simple config-based API
// ============================================================

/**
 * Options for createFlow().
 */
export interface CreateFlowOptions<TState = Record<string, unknown>> {
	/** Zod schema for typed state access and validation */
	stateSchema?: ZodSchema<TState>;

	/** Enable persistence for pause/resume. Can be `true` for in-memory, or a RunStore instance */
	persistence?: boolean | RunStore;

	/** Additional nodes to register beyond builtins */
	nodes?: NodeTypeDefinition<unknown, unknown>[];

	/** Node type IDs to exclude from builtins */
	excludeNodes?: string[];

	/** Resume from a previous run */
	resume?: RuntimeResumeOptions;

	/** Event listener to attach before run */
	onEvent?: (event: RuntimeEvent) => void;
}

/**
 * Create a flow runtime from a YAML file path or FlowDefinition.
 *
 * This is the recommended way to create runtimes. It:
 * - Parses YAML and validates against FlowDefinitionSchema
 * - Registers all builtin nodes automatically
 * - Provides typed state access via generics
 * - Includes pause/resume/abort convenience methods
 *
 * @param source - Path to YAML file, or a FlowDefinition object
 * @param options - Optional configuration
 * @returns TypedRuntime with convenience methods
 *
 * @example Minimal
 * ```ts
 * const runtime = await createFlow('./flow.yaml');
 * await runtime.run({ input: "value" });
 * ```
 *
 * @example With typed state
 * ```ts
 * const runtime = await createFlow<MyState>('./flow.yaml', {
 *   stateSchema: MyStateSchema,
 * });
 * const state: MyState = runtime.getState();
 * runtime.pause();  // Built-in convenience method
 * ```
 */
export async function createFlow<TState = Record<string, unknown>>(
	source: string | FlowDefinition,
	options: CreateFlowOptions<TState> = {},
): Promise<TypedRuntime<TState>> {
	// 1. Load flow definition
	const flow = await loadFlow(source);

	// 2. Create registry with builtins + custom nodes
	const registry = createRegistry(options.nodes, options.excludeNodes);

	// 3. Resolve persistence store
	const store = resolveStore(options.persistence);

	// 4. Create runtime
	const runtime = createRuntime({
		flow,
		registry,
		store,
		resume: options.resume,
	});

	// 5. Attach event listener if provided
	if (options.onEvent) {
		runtime.onEvent(options.onEvent);
	}

	// 6. Wrap with typed state and convenience methods
	return createTypedRuntime<TState>(runtime, options.stateSchema);
}

// ============================================================
// HELPERS
// ============================================================

async function loadFlow(source: string | FlowDefinition): Promise<FlowDefinition> {
	if (typeof source === "object") {
		// Already a FlowDefinition - validate it
		// Note: File references won't work without a flowDir
		return FlowDefinitionSchema.parse(source);
	}

	// Determine flow directory for relative file resolution
	let flowDir = process.cwd();
	let content: string;

	if (source.includes("\n") || source.startsWith("name:")) {
		// Looks like YAML content - use cwd for file resolution
		content = source;
	} else {
		// Treat as file path
		flowDir = dirname(resolve(source));
		content = await readFile(source, "utf-8");
	}

	const flow = parseYamlContent(content);

	// Resolve file references (promptFile, outputSchemaFile)
	await resolveFileReferences(flow, flowDir);

	// Validate claude.agent nodes have output schemas
	validateClaudeNodes(flow);

	return flow;
}

function parseYamlContent(content: string): FlowDefinition {
	const parsed = parseYaml(content) as Record<string, unknown>;

	// Handle optional `flow:` wrapper
	const flowData =
		"flow" in parsed && parsed.flow && typeof parsed.flow === "object"
			? (parsed.flow as Record<string, unknown>)
			: parsed;

	return FlowDefinitionSchema.parse(flowData);
}

/**
 * Resolve file references in node inputs.
 *
 * Supports:
 * - `promptFile: ./path/to/prompt.md` → loads file content into `prompt`
 * - `outputSchemaFile: ./path/to/schema.ts` → imports Zod schema, converts to JSON Schema
 */
async function resolveFileReferences(flow: FlowDefinition, flowDir: string): Promise<void> {
	for (const node of flow.nodes) {
		const input = node.input as Record<string, unknown>;

		// Resolve promptFile → prompt
		if (typeof input.promptFile === "string") {
			const promptPath = resolve(flowDir, input.promptFile);
			try {
				input.prompt = await readFile(promptPath, "utf-8");
			} catch (error) {
				throw new Error(
					`Failed to load promptFile for node "${node.id}": ${promptPath}\n` +
						`${error instanceof Error ? error.message : String(error)}`,
				);
			}
			delete input.promptFile;
		}

		// Resolve outputSchemaFile → options.output_schema
		if (typeof input.outputSchemaFile === "string") {
			const schemaPath = resolve(flowDir, input.outputSchemaFile);
			try {
				// Dynamic import the TypeScript/JavaScript module
				const mod = await import(schemaPath);
				const zodSchema = mod.schema ?? mod.default;

				if (!zodSchema || typeof zodSchema.parse !== "function") {
					throw new Error(
						`Schema file must export 'schema' or default as a Zod schema. ` +
							`Got: ${typeof zodSchema}`,
					);
				}

				// Convert Zod schema to JSON Schema for the SDK
				const jsonSchema = zodToJsonSchema(zodSchema, {
					target: "openApi3",
					$refStrategy: "none",
				});

				// Merge into options with SDK's expected outputFormat structure
				const existingOptions = (input.options as Record<string, unknown>) ?? {};
				input.options = {
					...existingOptions,
					outputFormat: {
						type: "json_schema" as const,
						schema: jsonSchema,
					},
				};
			} catch (error) {
				throw new Error(
					`Failed to load outputSchemaFile for node "${node.id}": ${schemaPath}\n` +
						`${error instanceof Error ? error.message : String(error)}`,
				);
			}
			delete input.outputSchemaFile;
		}
	}
}

/**
 * Validate that all claude.agent nodes have an output format.
 * This ensures structured output is available for bindings.
 */
function validateClaudeNodes(flow: FlowDefinition): void {
	for (const node of flow.nodes) {
		if (node.type === "claude.agent") {
			const input = node.input as Record<string, unknown>;
			const options = input.options as Record<string, unknown> | undefined;

			if (!options?.outputFormat) {
				throw new Error(
					`Node "${node.id}" (claude.agent) requires outputFormat. ` +
						`Use outputSchemaFile or inline options.outputFormat for bindings to work.`,
				);
			}
		}
	}
}

function createRegistry(
	additionalNodes?: NodeTypeDefinition<unknown, unknown>[],
	excludeNodes?: string[],
): NodeRegistry {
	const registry = new DefaultNodeRegistry();
	const excluded = new Set(excludeNodes ?? []);

	// Register builtins (unless excluded)
	for (const node of builtinNodes) {
		if (!excluded.has(node.type)) {
			registry.register(node as NodeTypeDefinition<unknown, unknown>);
		}
	}

	// Register additional nodes
	for (const node of additionalNodes ?? []) {
		registry.register(node);
	}

	return registry;
}

function resolveStore(persistence?: boolean | RunStore): RunStore | undefined {
	if (!persistence) return undefined;
	if (persistence === true) return new InMemoryRunStore();
	return persistence;
}
