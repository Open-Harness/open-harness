// Protocol: Flow
// See docs/reference/protocol-types.md for authoritative definitions

import type { AgentInbox } from "./agent.js";
import type { Hub } from "./hub.js";

export type NodeId = string;
export type NodeTypeId = string;

export interface FlowSpec {
	name: string;
	version?: number;
	description?: string;
	input?: Record<string, unknown>;
	policy?: FlowPolicy;
}

export interface FlowPolicy {
	failFast?: boolean;
}

export interface WhenExpr {
	equals?: { var: string; value: unknown };
	not?: WhenExpr;
	and?: WhenExpr[];
	or?: WhenExpr[];
}

export interface RetryPolicy {
	maxAttempts: number;
	backoffMs?: number;
}

export interface NodePolicy {
	timeoutMs?: number;
	retry?: RetryPolicy;
	continueOnError?: boolean;
}

export interface NodeSpec {
	id: NodeId;
	type: NodeTypeId;
	input: Record<string, unknown>;
	config?: Record<string, unknown>;
	when?: WhenExpr;
	policy?: NodePolicy;
}

export interface Edge {
	from: NodeId;
	to: NodeId;
}

export interface FlowYaml {
	flow: FlowSpec;
	nodes: NodeSpec[];
	edges: Edge[];
}

export interface NodeCapabilities {
	isStreaming?: boolean;
	supportsInbox?: boolean;
	isLongLived?: boolean;
}

export interface NodeRunContext {
	hub: Hub;
	runId: string;
	inbox?: AgentInbox;
}

// Note: ZodSchema is a type placeholder - actual implementation will use zod
export type ZodSchema<_T> = unknown;

export interface NodeTypeDefinition<TIn, TOut> {
	type: string;
	inputSchema: ZodSchema<TIn>;
	outputSchema: ZodSchema<TOut>;
	capabilities?: NodeCapabilities;
	run(ctx: NodeRunContext, input: TIn): Promise<TOut>;
}
