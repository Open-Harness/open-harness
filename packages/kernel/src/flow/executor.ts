// Flow executor (sequential MVP)
// Implements docs/flow/execution.md

import { AgentInboxImpl } from "../engine/inbox.js";
import type {
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

export interface FlowRunResult {
	outputs: Record<string, unknown>;
}

function createRunId(nodeId: string, attempt: number): string {
	return `run-${nodeId}-${attempt}-${Date.now()}`;
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

	await ctx.phase("Run Flow", async () => {
		for (const node of compiled.order) {
			const bindingContext: BindingContext = {
				flow: { input: flowInput },
				...outputs,
			};

			const shouldRun = evaluateWhen(node.when, bindingContext);
			if (!shouldRun) {
				outputs[node.id] = { skipped: true };
				continue;
			}

			const def = registry.get(node.type);
			await ctx.task(`node:${node.id}`, async () => {
				const output = await runNode(node, def, ctx, bindingContext);
				outputs[node.id] = output;
			});
		}
	});

	return { outputs };
}
