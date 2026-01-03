import type { NodeDefinition } from "../core/types.js";
import type { NodeRegistry, NodeRunContext } from "../registry/registry.js";

export interface NodeExecutionResult {
  nodeId: string;
  runId: string;
  output?: unknown;
  error?: string;
}

export interface ExecutorContext {
  registry: NodeRegistry;
  node: NodeDefinition;
  runContext: NodeRunContext;
  input: Record<string, unknown>;
}

export interface Executor {
  runNode(context: ExecutorContext): Promise<NodeExecutionResult>;
}

export declare class DefaultExecutor implements Executor {
  runNode(context: ExecutorContext): Promise<NodeExecutionResult>;
}
