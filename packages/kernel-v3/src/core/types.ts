import type { ZodType } from "zod";

/** Unique identifier for a node within a flow. */
export type NodeId = string;

/** Unique identifier for an edge within a flow. */
export type EdgeId = string;

/** Identifier for a registered node type. */
export type NodeTypeId = string;

/**
 * Declarative workflow-level state definition.
 *
 * @property {Record<string, unknown>} initial - Initial state for the run.
 * @property {Record<string, unknown>} [schema] - Optional metadata or schema.
 */
export type StateSchemaDefinition = {
  initial: Record<string, unknown>;
  schema?: Record<string, unknown>;
};

/**
 * Root flow definition for V3 runtime.
 *
 * @property {string} name - Human-readable flow name.
 * @property {number} [version] - Optional version number.
 * @property {StateSchemaDefinition} [state] - Optional state definition.
 * @property {NodeDefinition[]} nodes - Node list.
 * @property {EdgeDefinition[]} edges - Edge list.
 */
export type FlowDefinition = {
  name: string;
  version?: number;
  state?: StateSchemaDefinition;
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
};

/**
 * Optional UI hints for graph editors (e.g., ReactFlow).
 *
 * @property {number} x - X position.
 * @property {number} y - Y position.
 * @property {string} [label] - Display label.
 * @property {string} [color] - Node color.
 */
export type NodeUi = {
  x: number;
  y: number;
  label?: string;
  color?: string;
};

/**
 * Node instance within a flow definition.
 *
 * @property {NodeId} id - Node identifier.
 * @property {NodeTypeId} type - Node type id (registry key).
 * @property {Record<string, unknown>} input - Raw node input payload.
 * @property {WhenExpr} [when] - Optional runtime condition.
 * @property {NodePolicy} [policy] - Optional execution policy.
 * @property {NodeUi} [ui] - Optional UI metadata.
 */
export type NodeDefinition = {
  id: NodeId;
  type: NodeTypeId;
  input: Record<string, unknown>;
  when?: WhenExpr;
  policy?: NodePolicy;
  ui?: NodeUi;
};

/** Edge gating mode for inbound edges on a node. */
export type EdgeGate = "any" | "all";

/**
 * Edge-level iteration. Spawns multiple runs of the target node.
 *
 * @property {string} in - Binding expression that resolves to an array.
 * @property {string} as - Variable name for each item.
 */
export type EdgeForEach = {
  in: string;
  as: string;
};

/**
 * Edge between nodes. Edges are control-flow and may form cycles.
 *
 * @property {EdgeId} [id] - Optional edge id.
 * @property {NodeId} from - Source node id.
 * @property {NodeId} to - Target node id.
 * @property {WhenExpr} [when] - Optional condition for firing.
 * @property {EdgeGate} [gate] - Optional gating rule.
 * @property {EdgeForEach} [forEach] - Optional fan-out definition.
 * @property {number} [maxIterations] - Optional cap for loop edges.
 */
export type EdgeDefinition = {
  id?: EdgeId;
  from: NodeId;
  to: NodeId;
  when?: WhenExpr;
  gate?: EdgeGate;
  forEach?: EdgeForEach;
  maxIterations?: number;
};

/**
 * Declarative conditional expression.
 *
 * Variants:
 * - equals: compare a binding to a literal value
 * - not: logical negation
 * - and: logical conjunction
 * - or: logical disjunction
 */
export type WhenExpr =
  | { equals: { var: string; value: unknown } }
  | { not: WhenExpr }
  | { and: WhenExpr[] }
  | { or: WhenExpr[] };

/**
 * Retry policy for a node execution.
 *
 * @property {number} maxAttempts - Maximum number of attempts.
 * @property {number} [backoffMs] - Backoff delay in milliseconds.
 */
export type RetryPolicy = {
  maxAttempts: number;
  backoffMs?: number;
};

/**
 * Execution policy applied to a node.
 *
 * @property {RetryPolicy} [retry] - Retry configuration.
 * @property {number} [timeoutMs] - Timeout in milliseconds.
 * @property {boolean} [continueOnError] - Whether to continue on error.
 */
export type NodePolicy = {
  retry?: RetryPolicy;
  timeoutMs?: number;
  continueOnError?: boolean;
};

/** Zod schema for FlowDefinition validation. */
export declare const FlowDefinitionSchema: ZodType<FlowDefinition>;

/** Zod schema for NodeDefinition validation. */
export declare const NodeDefinitionSchema: ZodType<NodeDefinition>;

/** Zod schema for EdgeDefinition validation. */
export declare const EdgeDefinitionSchema: ZodType<EdgeDefinition>;

/** Zod schema for WhenExpr validation. */
export declare const WhenExprSchema: ZodType<WhenExpr>;
