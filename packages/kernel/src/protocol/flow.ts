// Protocol: Flow
// See docs/reference/protocol-types.md for authoritative definitions

import type { BindingContext } from "../flow/bindings.js";
import type { Hub } from "./hub.js";

export type { BindingContext };

export type NodeId = string;
export type NodeTypeId = string;

export interface FlowSpec {
	name: string;
	version?: number;
	description?: string;
	input?: Record<string, unknown>;
	nodePacks?: string[];
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

export interface NodePosition {
	x: number;
	y: number;
}

export interface NodeSpec {
	id: NodeId;
	type: NodeTypeId;
	input: Record<string, unknown>;
	config?: Record<string, unknown>;
	when?: WhenExpr;
	policy?: NodePolicy;
	/** Position for visual editor (ReactFlow) */
	position?: NodePosition;
}

/**
 * Edge type discriminator.
 * - "forward": Standard DAG edge, included in topological sort (default)
 * - "loop": Back-edge for cycles, evaluated at runtime, excluded from topo sort
 */
export type EdgeType = "forward" | "loop";

export interface Edge {
	from: NodeId;
	to: NodeId;
	when?: WhenExpr;
	/**
	 * Edge type. Defaults to "forward".
	 * Loop edges enable controlled cycles (e.g., coder → reviewer → coder).
	 */
	type?: EdgeType;
	/**
	 * Maximum iterations for loop edges. Required for loop edges.
	 * Prevents infinite loops - flow fails if exceeded.
	 * Can be a number or a template string (e.g., "{{ flow.input.maxIterations }}").
	 */
	maxIterations?: number | string;
}

export interface FlowYaml {
	flow: FlowSpec;
	nodes: NodeSpec[];
	edges: Edge[];
}

export interface NodeCapabilities {
	isStreaming?: boolean;
	supportsMultiTurn?: boolean;
	isLongLived?: boolean;
	/** Container nodes can execute child nodes (e.g., foreach loops) */
	isContainer?: boolean;
	/** Creates a fresh session scope for each iteration/invocation */
	createsSession?: boolean;
	/** Control nodes that evaluate WhenExpr need binding context */
	needsBindingContext?: boolean;
}

/**
 * Context provided to node execution.
 *
 * Agent nodes use V2 SDK session pattern:
 * - hub: for emitting events and subscribing to session:message
 * - runId: routing key for targeted message injection
 */
export interface NodeRunContext {
	hub: Hub;
	runId: string;
}

/**
 * Extended context for control nodes that need to evaluate WhenExpr.
 * Provides access to the binding context for variable resolution.
 */
export interface ControlNodeContext extends NodeRunContext {
	/**
	 * Binding context for evaluating WhenExpr conditions.
	 * Contains flow.input and all upstream node outputs.
	 */
	bindingContext: BindingContext;
}

/**
 * Extended context for container nodes that can execute children.
 * Provides the ability to run child nodes within a loop or scope.
 */
export interface ContainerNodeContext extends NodeRunContext {
	/**
	 * Execute a child node by ID with the given input.
	 * The sessionId is passed through to maintain session scope.
	 */
	executeChild: (
		nodeId: NodeId,
		input: Record<string, unknown>,
	) => Promise<Record<string, unknown>>;
}

/**
 * Input type for control.foreach node.
 */
export interface ForeachInput {
	/** Array of items to iterate over */
	items: unknown[];
	/** Variable name to bind each item to (e.g., "task") */
	as: string;
	/** Child node IDs to execute per iteration */
	body: NodeId[];
}

/**
 * Output type for control.foreach node.
 */
export interface ForeachOutput {
	/** Results from each iteration */
	iterations: Array<{
		item: unknown;
		sessionId: string;
		outputs: Record<string, unknown>;
	}>;
}

// Note: ZodSchema is a type placeholder - actual implementation will use zod
export type ZodSchema<_T> = unknown;

/** Port definition for visual editor */
export interface PortDefinition {
	name: string;
	type: "input" | "output";
	dataType?: string;
	description?: string;
}

/** Metadata for visual editor (ReactFlow node palette) */
export interface NodeMetadata {
	displayName: string;
	description?: string;
	category?: string;
	icon?: string;
	color?: string;
	ports?: PortDefinition[];
}

export interface NodeTypeDefinition<TIn, TOut> {
	type: string;
	inputSchema: ZodSchema<TIn>;
	outputSchema: ZodSchema<TOut>;
	capabilities?: NodeCapabilities;
	/** Metadata for visual editor */
	metadata?: NodeMetadata;
	run(ctx: NodeRunContext, input: TIn): Promise<TOut>;
}
