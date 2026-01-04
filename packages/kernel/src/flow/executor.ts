// Flow executor (sequential MVP)
// Implements docs/flow/execution.md

import type {
	ContainerNodeContext,
	ControlNodeContext,
	Edge,
	FlowYaml,
	NodeRunContext,
	NodeSpec,
	NodeTypeDefinition,
} from "../protocol/flow.js";
import type { Hub } from "../protocol/hub.js";
import type { BindingContext } from "./bindings.js";
import { resolveBindingPath, resolveBindings } from "./bindings.js";
import { compileFlow } from "./compiler.js";
import type { NodeRegistry } from "./registry.js";
import { evaluateWhen } from "./when.js";

/**
 * Internal execution context - created automatically by executeFlow.
 * You don't need to create this yourself.
 */
interface ExecutionContext {
	hub: Hub;
	phase: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
	task: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
}

/**
 * @deprecated Use the simplified executeFlow(flow, registry, hub) signature instead.
 * This interface is kept for backwards compatibility but will be removed.
 */
export interface FlowExecutionContext {
	hub: Hub;
	phase: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
	task: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
}

interface FlowRunResult {
	outputs: Record<string, unknown>;
}

type ErrorMarker = {
	failed: true;
	error: { message: string; stack?: string };
	attempts: number;
};

type EdgeStatus = "pending" | "fired" | "skipped";

type EdgeState = {
	edge: Edge;
	status: EdgeStatus;
};

type EdgeIndex = {
	incoming: Map<string, EdgeState[]>;
	outgoing: Map<string, EdgeState[]>;
};

/**
 * Loop edge tracking for controlled cycles.
 * Each loop edge has an iteration counter to prevent infinite loops.
 */
type LoopEdgeState = {
	edge: Edge;
	iterationCount: number;
};

type LoopEdgeIndex = {
	/** Loop edges keyed by source node */
	outgoing: Map<string, LoopEdgeState[]>;
};

function buildLoopEdgeIndex(loopEdges: Edge[]): LoopEdgeIndex {
	const outgoing = new Map<string, LoopEdgeState[]>();

	for (const edge of loopEdges) {
		const state: LoopEdgeState = { edge, iterationCount: 0 };
		const list = outgoing.get(edge.from);
		if (list) {
			list.push(state);
		} else {
			outgoing.set(edge.from, [state]);
		}
	}

	return { outgoing };
}

/**
 * Error thrown when a loop edge exceeds its maximum iterations.
 */
export class LoopIterationExceededError extends Error {
	constructor(
		public readonly edgeFrom: string,
		public readonly edgeTo: string,
		public readonly maxIterations: number,
	) {
		super(
			`Loop edge ${edgeFrom} → ${edgeTo} exceeded maximum iterations (${maxIterations})`,
		);
		this.name = "LoopIterationExceededError";
	}
}

/**
 * Resolve maxIterations which can be a number or template string.
 * Template strings like "{{ flow.input.maxIterations }}" are resolved at runtime.
 */
function resolveMaxIterations(
	value: number | string | undefined,
	context: BindingContext,
): number {
	if (value === undefined) {
		return 1; // Default
	}
	if (typeof value === "number") {
		return value;
	}
	// Template string - resolve it
	const match = value.match(/^{{\s*([^}]+?)\s*}}$/);
	if (!match) {
		throw new Error(`Invalid maxIterations template: ${value}`);
	}
	const path = match[1]?.trim() ?? "";
	const resolved = resolveBindingPath(context, path);
	if (!resolved.found) {
		throw new Error(`maxIterations binding path not found: ${path}`);
	}
	const num = Number(resolved.value);
	if (!Number.isInteger(num) || num <= 0) {
		throw new Error(
			`maxIterations must resolve to a positive integer, got: ${resolved.value}`,
		);
	}
	return num;
}

function createRunId(nodeId: string, attempt: number): string {
	return `run-${nodeId}-${attempt}-${Date.now()}`;
}

function buildEdgeIndex(edges: Edge[]): EdgeIndex {
	const incoming = new Map<string, EdgeState[]>();
	const outgoing = new Map<string, EdgeState[]>();

	for (const edge of edges) {
		const state: EdgeState = { edge, status: "pending" };

		const incomingList = incoming.get(edge.to);
		if (incomingList) {
			incomingList.push(state);
		} else {
			incoming.set(edge.to, [state]);
		}

		const outgoingList = outgoing.get(edge.from);
		if (outgoingList) {
			outgoingList.push(state);
		} else {
			outgoing.set(edge.from, [state]);
		}
	}

	return { incoming, outgoing };
}

async function resolveOutgoingEdges(
	nodeId: string,
	index: EdgeIndex,
	context: BindingContext,
): Promise<void> {
	const edges = index.outgoing.get(nodeId) ?? [];
	for (const edgeState of edges) {
		const shouldFire = await evaluateWhen(edgeState.edge.when, context);
		edgeState.status = shouldFire ? "fired" : "skipped";
	}
}

function createBindingContext(
	flowInput: Record<string, unknown>,
	outputs: Record<string, unknown>,
): BindingContext {
	return { flow: { input: flowInput }, ...outputs };
}

async function runNode(
	node: NodeSpec,
	def: NodeTypeDefinition<unknown, unknown>,
	ctx: ExecutionContext,
	bindingContext: BindingContext,
	attempt: number,
	registry?: NodeRegistry,
	flowInput?: Record<string, unknown>,
	outputs?: Record<string, unknown>,
	allNodes?: NodeSpec[],
): Promise<unknown> {
	const resolvedInput = await resolveBindings(node.input, bindingContext);
	const inputSchema = def.inputSchema as
		| {
				parse: (value: unknown) => unknown;
		  }
		| undefined;
	const parsedInput = inputSchema
		? inputSchema.parse(resolvedInput)
		: resolvedInput;
	const runId = createRunId(node.id, attempt);

	// Base context for all nodes
	const baseContext: NodeRunContext = {
		hub: ctx.hub,
		runId,
	};

	// Build context based on node capabilities
	let runCtx: NodeRunContext | ContainerNodeContext | ControlNodeContext =
		baseContext;

	// Control nodes that need binding context get it
	if (def.capabilities?.needsBindingContext) {
		runCtx = {
			...runCtx,
			bindingContext,
		} as ControlNodeContext;
	}

	// Container nodes get executeChild for running child nodes
	if (
		def.capabilities?.isContainer &&
		registry &&
		flowInput &&
		outputs &&
		allNodes
	) {
		const executeChild = async (
			childId: string,
			childInput: Record<string, unknown>,
		): Promise<Record<string, unknown>> => {
			// Find child node spec in the flow
			const childNode = allNodes.find((n) => n.id === childId);
			if (!childNode) {
				throw new Error(`Child node "${childId}" not found in flow`);
			}

			// Get node type definition from registry
			const childDef = registry.get(childNode.type);

			// Merge child input with existing bindings
			const childBindingContext = {
				flow: { input: flowInput },
				...outputs,
				...childInput, // Loop variable bindings
			};

			// Resolve child node's input bindings
			const resolvedChildInput = await resolveBindings(
				childNode.input,
				childBindingContext,
			);
			const childInputSchema = childDef.inputSchema as
				| { parse: (value: unknown) => unknown }
				| undefined;
			const parsedChildInput = childInputSchema
				? childInputSchema.parse(resolvedChildInput)
				: resolvedChildInput;

			// Execute the child node
			const childRunId = createRunId(childId, 1);
			// Control nodes need binding context to evaluate conditions
			const childRunCtx = childDef.capabilities?.needsBindingContext
				? { hub: ctx.hub, runId: childRunId, bindingContext: childBindingContext }
				: { hub: ctx.hub, runId: childRunId };
			const childResult = await childDef.run(
				childRunCtx,
				parsedChildInput,
			);

			// Validate output if schema exists
			const childOutputSchema = childDef.outputSchema as
				| { parse: (value: unknown) => unknown }
				| undefined;
			const validatedOutput = childOutputSchema
				? childOutputSchema.parse(childResult)
				: childResult;
			return validatedOutput as Record<string, unknown>;
		};

		// Add executeChild to context (preserves bindingContext if already set)
		runCtx = {
			...runCtx,
			executeChild,
		};
	}

	const result = await def.run(runCtx, parsedInput);
	const outputSchema = def.outputSchema as
		| {
				parse: (value: unknown) => unknown;
		  }
		| undefined;
	const parsedOutput = outputSchema ? outputSchema.parse(result) : result;
	return parsedOutput;
}

function getErrorMessage(error: unknown): { message: string; stack?: string } {
	if (error instanceof Error) {
		return { message: error.message, stack: error.stack };
	}
	return { message: String(error) };
}

function createErrorMarker(error: unknown, attempts: number): ErrorMarker {
	const { message, stack } = getErrorMessage(error);
	return { failed: true, error: { message, stack }, attempts };
}

async function delay(ms: number): Promise<void> {
	if (ms <= 0) return;
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
	run: () => Promise<T>,
	timeoutMs?: number,
): Promise<T> {
	if (!timeoutMs || timeoutMs <= 0) {
		return await run();
	}

	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	const timeoutPromise = new Promise<T>((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(`Node execution timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	});

	try {
		return await Promise.race([run(), timeoutPromise]);
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

async function runNodeWithPolicy(
	node: NodeSpec,
	def: NodeTypeDefinition<unknown, unknown>,
	ctx: ExecutionContext,
	bindingContext: BindingContext,
	registry?: NodeRegistry,
	flowInput?: Record<string, unknown>,
	outputs?: Record<string, unknown>,
	allNodes?: NodeSpec[],
): Promise<{ output?: unknown; error?: unknown; attempts: number }> {
	const maxAttempts = node.policy?.retry?.maxAttempts ?? 1;
	const backoffMs = node.policy?.retry?.backoffMs ?? 0;
	const timeoutMs = node.policy?.timeoutMs;

	let attempts = 0;
	let lastError: unknown = null;

	while (attempts < maxAttempts) {
		attempts += 1;
		try {
			const output = await withTimeout(
				() =>
					runNode(
						node,
						def,
						ctx,
						bindingContext,
						attempts,
						registry,
						flowInput,
						outputs,
						allNodes,
					),
				timeoutMs,
			);
			return { output, attempts };
		} catch (error) {
			lastError = error;
			if (attempts >= maxAttempts) {
				break;
			}
			await delay(backoffMs);
		}
	}

	return { error: lastError, attempts };
}

function shouldContinueOnError(node: NodeSpec, flow: FlowYaml): boolean {
	if (node.policy?.continueOnError) return true;
	if (flow.flow.policy?.failFast === false) return true;
	return false;
}

/**
 * Execute a flow.
 *
 * @param flow - The parsed flow YAML
 * @param registry - Node type registry
 * @param hubOrCtx - Either a Hub instance (recommended) or a FlowExecutionContext (deprecated)
 * @param inputOverrides - Optional input overrides
 */
export async function executeFlow(
	flow: FlowYaml,
	registry: NodeRegistry,
	hubOrCtx: Hub | FlowExecutionContext,
	inputOverrides?: Record<string, unknown>,
): Promise<FlowRunResult> {
	// Create internal context - either from hub directly or from legacy context
	const ctx: ExecutionContext =
		"emit" in hubOrCtx
			? {
					hub: hubOrCtx,
					phase: <T>(name: string, fn: () => Promise<T>) =>
						hubOrCtx.scoped({ phase: { name } }, fn) as Promise<T>,
					task: <T>(id: string, fn: () => Promise<T>) =>
						hubOrCtx.scoped({ task: { id } }, fn) as Promise<T>,
				}
			: hubOrCtx;

	// Activate session so abort/send operations work (idempotent - safe on resume)
	if (!ctx.hub.sessionActive) {
		ctx.hub.startSession();
	}

	const compiled = compileFlow(flow);
	const outputs: Record<string, unknown> = {};
	const flowInput = { ...(flow.flow.input ?? {}), ...(inputOverrides ?? {}) };
	// Forward edges control DAG traversal; loop edges enable controlled cycles
	const edgeIndex = buildEdgeIndex(compiled.forwardEdges);
	const loopEdgeIndex = buildLoopEdgeIndex(compiled.loopEdges);
	// Build node-to-index map for loop edge jumps
	const nodeIndexMap = new Map<string, number>(
		compiled.order.map((node, i) => [node.id, i]),
	);

	await ctx.phase("Run Flow", async () => {
		// T030: Check for resumption state and determine starting index
		const resumptionState = ctx.hub.getResumptionState();
		let startIndex = 0;

		if (resumptionState) {
			// Resume from where we left off - start after the last completed node
			startIndex = resumptionState.currentNodeIndex;
			// Restore outputs from previous execution
			Object.assign(outputs, resumptionState.outputs);
			// Resolve edge states for all completed nodes so continuation works
			const bindingCtx = createBindingContext(flowInput, outputs);
			for (const nodeId of Object.keys(resumptionState.outputs)) {
				await resolveOutgoingEdges(nodeId, edgeIndex, bindingCtx);
			}
		}

		for (
			let nodeIndex = startIndex;
			nodeIndex < compiled.order.length;
			nodeIndex++
		) {
			const node = compiled.order[nodeIndex];

			// T020: Check abort signal between nodes for pause/resume support
			if (ctx.hub.getAbortSignal().aborted) {
				// T030: Report actual state to Hub before breaking
				ctx.hub.updatePausedState(
					nodeIndex,
					{ ...outputs },
					node.id,
					flow.flow.name,
				);
				break;
			}

			const bindingContext = createBindingContext(flowInput, outputs);
			const incoming = edgeIndex.incoming.get(node.id) ?? [];

			if (incoming.length > 0) {
				const resolved = incoming.every((edge) => edge.status !== "pending");
				if (!resolved) {
					throw new Error(`Node "${node.id}" has unresolved incoming edges`);
				}

				const fired = incoming.some((edge) => edge.status === "fired");
				if (!fired) {
					outputs[node.id] = { skipped: true };
					ctx.hub.emit({
						type: "node:skipped",
						nodeId: node.id,
						reason: "edge",
					});
					await resolveOutgoingEdges(
						node.id,
						edgeIndex,
						createBindingContext(flowInput, outputs),
					);
					continue;
				}
			}

			const shouldRun = await evaluateWhen(node.when, bindingContext);
			if (!shouldRun) {
				outputs[node.id] = { skipped: true };
				ctx.hub.emit({
					type: "node:skipped",
					nodeId: node.id,
					reason: "when",
				});
				await resolveOutgoingEdges(
					node.id,
					edgeIndex,
					createBindingContext(flowInput, outputs),
				);
				continue;
			}

			const def = registry.get(node.type);
			let attempts = 0;
			const startTime = Date.now();

			// Emit node:start before execution
			ctx.hub.emit({
				type: "node:start",
				nodeId: node.id,
				nodeType: node.type,
			});

			try {
				await ctx.task(`node:${node.id}`, async () => {
					const execution = await runNodeWithPolicy(
						node,
						def,
						ctx,
						bindingContext,
						registry,
						flowInput,
						outputs,
						compiled.nodes, // All nodes for child lookup
					);
					attempts = execution.attempts;
					if (execution.error) {
						throw execution.error;
					}
					outputs[node.id] = execution.output;
				});

				// Emit node:complete on success
				ctx.hub.emit({
					type: "node:complete",
					nodeId: node.id,
					output: outputs[node.id],
					durationMs: Date.now() - startTime,
				});
			} catch (error) {
				outputs[node.id] = createErrorMarker(error, attempts);
				const { message, stack } = getErrorMessage(error);

				// Emit node:error on failure
				ctx.hub.emit({
					type: "node:error",
					nodeId: node.id,
					error: message,
					stack,
				});

				if (!shouldContinueOnError(node, flow)) {
					throw error;
				}
			}

			await resolveOutgoingEdges(
				node.id,
				edgeIndex,
				createBindingContext(flowInput, outputs),
			);

			// Check outgoing loop edges for controlled cycles
			const loopEdges = loopEdgeIndex.outgoing.get(node.id) ?? [];
			for (const loopState of loopEdges) {
				// Calculate max iterations first (needed for $last and $maxIterations)
				const maxIter = resolveMaxIterations(
					loopState.edge.maxIterations,
					createBindingContext(flowInput, outputs),
				);

				// Create binding context with iteration variables for edge condition
				const loopBindingContext = {
					...createBindingContext(flowInput, outputs),
					$iteration: loopState.iterationCount,
					$first: loopState.iterationCount === 0,
					$last: loopState.iterationCount >= maxIter - 1,
					$maxIterations: maxIter,
				};

				const shouldLoop = await evaluateWhen(
					loopState.edge.when,
					loopBindingContext,
				);

				if (shouldLoop) {
					loopState.iterationCount++;

					if (loopState.iterationCount >= maxIter) {
						throw new LoopIterationExceededError(
							loopState.edge.from,
							loopState.edge.to,
							maxIter,
						);
					}

					// Emit loop iteration event
					ctx.hub.emit({
						type: "loop:iterate",
						edgeFrom: loopState.edge.from,
						edgeTo: loopState.edge.to,
						iteration: loopState.iterationCount,
						maxIterations: maxIter,
					});

					// Jump back to target node - adjust loop index to re-execute from there
					// Note: Node outputs are intentionally preserved across loop iterations.
					// Re-executed nodes overwrite their outputs with fresh values (e.g., coder.code).
					// This allows loop conditions to reference latest outputs (e.g., reviewer.passed).
					const targetIndex = nodeIndexMap.get(loopState.edge.to);
					if (targetIndex !== undefined) {
						// Set nodeIndex to targetIndex - 1 because the for-loop will increment
						nodeIndex = targetIndex - 1;
						break; // Only one loop edge can fire per node completion
					}
				}
			}
		}

		// T031/T042: Clean up paused session after flow execution completes (unless paused)
		// If hub is "paused", keep the session state for later resumption
		// Otherwise (completed, aborted, failed), the old resumption state is consumed
		if (ctx.hub.status !== "paused") {
			ctx.hub.clearPausedSession(ctx.hub.current().sessionId ?? "");
		}
	});

	return { outputs };
}
