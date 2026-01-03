import type { ZodType } from "zod";

export type NodeId = string;
export type EdgeId = string;
export type NodeTypeId = string;

export type StateSchemaDefinition = {
  initial: Record<string, unknown>;
  schema?: Record<string, unknown>;
};

export type FlowDefinition = {
  name: string;
  version?: number;
  state?: StateSchemaDefinition;
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
};

export type NodeUi = {
  x: number;
  y: number;
  label?: string;
  color?: string;
};

export type NodeDefinition = {
  id: NodeId;
  type: NodeTypeId;
  input: Record<string, unknown>;
  when?: WhenExpr;
  policy?: NodePolicy;
  ui?: NodeUi;
};

export type EdgeGate = "any" | "all";

export type EdgeForEach = {
  in: string;
  as: string;
};

export type EdgeDefinition = {
  id?: EdgeId;
  from: NodeId;
  to: NodeId;
  when?: WhenExpr;
  gate?: EdgeGate;
  forEach?: EdgeForEach;
  maxIterations?: number;
};

export type WhenExpr =
  | { equals: { var: string; value: unknown } }
  | { not: WhenExpr }
  | { and: WhenExpr[] }
  | { or: WhenExpr[] };

export type RetryPolicy = {
  maxAttempts: number;
  backoffMs?: number;
};

export type NodePolicy = {
  retry?: RetryPolicy;
  timeoutMs?: number;
  continueOnError?: boolean;
};

export declare const FlowDefinitionSchema: ZodType<FlowDefinition>;
export declare const NodeDefinitionSchema: ZodType<NodeDefinition>;
export declare const EdgeDefinitionSchema: ZodType<EdgeDefinition>;
export declare const WhenExprSchema: ZodType<WhenExpr>;
