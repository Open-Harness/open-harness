import type { z } from "zod";
import type { NodeCapabilities, NodeTypeId } from "../workflow/types.js";
import type { AgentExecuteContext } from "../agent.js";

/**
 * Planned runtime context passed to node type handlers.
 *
 * MVP will likely run nodes as kernel Agents, so this is currently aligned with AgentExecuteContext.
 * Later, we may extend this with engine-specific helpers (bindings, state store, etc.).
 */
export type NodeRunContext = AgentExecuteContext;

export interface NodeTypeDefinition<TIn = unknown, TOut = unknown> {
	type: NodeTypeId;
	inputSchema: z.ZodType<TIn>;
	outputSchema: z.ZodType<TOut>;
	capabilities?: NodeCapabilities;

	run(input: TIn, ctx: NodeRunContext): Promise<TOut>;
}

