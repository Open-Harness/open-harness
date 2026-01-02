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
import { resolveBindings } from "./bindings.js";
import { compileFlow } from "./compiler.js";
import type { NodeRegistry } from "./registry.js";
import { evaluateWhen } from "./when.js";

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

function resolveOutgoingEdges(
	nodeId: string,
	index: EdgeIndex,
	context: BindingContext,
): void {
	const edges = index.outgoing.get(nodeId) ?? [];
	for (const edgeState of edges) {
		const shouldFire = evaluateWhen(edgeState.edge.when, context);
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
	ctx: FlowExecutionContext,
	bindingContext: BindingContext,
	attempt: number,
	registry?: NodeRegistry,
	flowInput?: Record<string, unknown>,
	outputs?: Record<string, unknown>,
	allNodes?: NodeSpec[],
): Promise<unknown> {
	const resolvedInput = resolveBindings(node.input, bindingContext);
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
			const resolvedChildInput = resolveBindings(
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
			const childResult = await childDef.run(
				{ hub: ctx.hub, runId: childRunId },
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
	ctx: FlowExecutionContext,
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

export async function executeFlow(
	flow: FlowYaml,
	registry: NodeRegistry,
	ctx: FlowExecutionContext,
	inputOverrides?: Record<string, unknown>,
): Promise<FlowRunResult> {
	const compiled = compileFlow(flow);
	const outputs: Record<string, unknown> = {};
	const flowInput = { ...(flow.flow.input ?? {}), ...(inputOverrides ?? {}) };
	const edgeIndex = buildEdgeIndex(compiled.edges);

	await ctx.phase("Run Flow", async () => {
		for (const node of compiled.order) {
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
					resolveOutgoingEdges(
						node.id,
						edgeIndex,
						createBindingContext(flowInput, outputs),
					);
					continue;
				}
			}

			const shouldRun = evaluateWhen(node.when, bindingContext);
			if (!shouldRun) {
				outputs[node.id] = { skipped: true };
				ctx.hub.emit({
					type: "node:skipped",
					nodeId: node.id,
					reason: "when",
				});
				resolveOutgoingEdges(
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

			resolveOutgoingEdges(
				node.id,
				edgeIndex,
				createBindingContext(flowInput, outputs),
			);
		}
	});

	return { outputs };
}
