// Flow executor (sequential MVP)
// Implements docs/flow/execution.md

import { AgentInboxImpl } from "../engine/inbox.js";
import type {
	Edge,
	FlowYaml,
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
	const runId = createRunId(node.id, 0);

	const runCtx = {
		hub: ctx.hub,
		runId,
		inbox: def.capabilities?.supportsInbox ? new AgentInboxImpl() : undefined,
	};

	const result = await def.run(runCtx, parsedInput);
	const outputSchema = def.outputSchema as
		| {
				parse: (value: unknown) => unknown;
		  }
		| undefined;
	const parsedOutput = outputSchema ? outputSchema.parse(result) : result;
	return parsedOutput;
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
				resolveOutgoingEdges(
					node.id,
					edgeIndex,
					createBindingContext(flowInput, outputs),
				);
				continue;
			}

			const def = registry.get(node.type);
			await ctx.task(`node:${node.id}`, async () => {
				const output = await runNode(node, def, ctx, bindingContext);
				outputs[node.id] = output;
			});

			resolveOutgoingEdges(
				node.id,
				edgeIndex,
				createBindingContext(flowInput, outputs),
			);
		}
	});

	return { outputs };
}
