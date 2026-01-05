import type { ZodType } from "zod";
import { z } from "zod";

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
 * Structured conditional expression (YAML AST format).
 *
 * Variants:
 * - equals: compare a binding to a literal value
 * - not: logical negation
 * - and: logical conjunction
 * - or: logical disjunction
 */
export type WhenExprAST =
  | { equals: { var: string; value: unknown } }
  | { not: WhenExprAST }
  | { and: WhenExprAST[] }
  | { or: WhenExprAST[] };

/**
 * Conditional expression - either a JSONata string or structured AST.
 *
 * String format uses JSONata expressions:
 * - "status = 'success'"
 * - "$exists(reviewer) and reviewer.passed"
 * - "count > 5"
 *
 * AST format for declarative conditions:
 * - { equals: { var: "status", value: "success" } }
 * - { and: [...] }
 */
export type WhenExpr = string | WhenExprAST;

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

const NodeIdSchema = z.string().min(1, "Node id is required");
const NodeTypeIdSchema = z.string().min(1, "Node type is required");
const EdgeIdSchema = z.string().min(1).optional();

const StateSchemaDefinitionSchema = z.object({
  initial: z.record(z.string(), z.unknown()),
  schema: z.record(z.string(), z.unknown()).optional(),
});

const NodeUiSchema = z.object({
  x: z.number(),
  y: z.number(),
  label: z.string().optional(),
  color: z.string().optional(),
});

const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1),
  backoffMs: z.number().int().nonnegative().optional(),
});

const NodePolicySchema = z.object({
  retry: RetryPolicySchema.optional(),
  timeoutMs: z.number().int().nonnegative().optional(),
  continueOnError: z.boolean().optional(),
});

/** Zod schema for WhenExprAST validation (structured format). */
export const WhenExprASTSchema: ZodType<WhenExprAST> = z.lazy(() =>
  z.union([
    z.object({
      equals: z.object({ var: z.string(), value: z.unknown() }),
    }),
    z.object({
      not: WhenExprASTSchema,
    }),
    z.object({
      and: z.array(WhenExprASTSchema),
    }),
    z.object({
      or: z.array(WhenExprASTSchema),
    }),
  ]),
);

/** Zod schema for WhenExpr validation (string or AST). */
export const WhenExprSchema: ZodType<WhenExpr> = z.union([
  z.string(),
  WhenExprASTSchema,
]);

const EdgeForEachSchema = z.object({
  in: z.string().min(1),
  as: z.string().min(1),
});

/** Zod schema for EdgeDefinition validation. */
export const EdgeDefinitionSchema: ZodType<EdgeDefinition> = z.object({
  id: EdgeIdSchema,
  from: NodeIdSchema,
  to: NodeIdSchema,
  when: WhenExprSchema.optional(),
  gate: z.enum(["any", "all"]).optional(),
  forEach: EdgeForEachSchema.optional(),
  maxIterations: z.number().int().positive().optional(),
});

/** Zod schema for NodeDefinition validation. */
export const NodeDefinitionSchema: ZodType<NodeDefinition> = z.object({
  id: NodeIdSchema,
  type: NodeTypeIdSchema,
  input: z.record(z.string(), z.unknown()),
  when: WhenExprSchema.optional(),
  policy: NodePolicySchema.optional(),
  ui: NodeUiSchema.optional(),
});

/** Zod schema for FlowDefinition validation. */
export const FlowDefinitionSchema: ZodType<FlowDefinition> = z
  .object({
    name: z.string().min(1),
    version: z.number().optional(),
    state: StateSchemaDefinitionSchema.optional(),
    nodes: z.array(NodeDefinitionSchema),
    edges: z.array(EdgeDefinitionSchema),
  })
  .superRefine((value, ctx) => {
    const ids = value.nodes.map((node) => node.id);
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Node ids must be unique",
        path: ["nodes"],
      });
    }

    for (const edge of value.edges) {
      if (!unique.has(edge.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Edge from "${edge.from}" does not reference a node`,
          path: ["edges"],
        });
      }
      if (!unique.has(edge.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Edge to "${edge.to}" does not reference a node`,
          path: ["edges"],
        });
      }
    }
  });
