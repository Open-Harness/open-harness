import type { NodeDefinition } from "../core/types.js";
import type { NodeRegistry, NodeRunContext } from "../registry/registry.js";

/**
 * Result of a node execution.
 *
 * @property {string} nodeId - Node id.
 * @property {string} runId - Run id for this invocation.
 * @property {unknown} [output] - Output payload.
 * @property {string} [error] - Error string, if failed.
 */
export interface NodeExecutionResult {
  nodeId: string;
  runId: string;
  output?: unknown;
  error?: string;
}

/**
 * Executor context for a single node run.
 *
 * @property {NodeRegistry} registry - Node registry.
 * @property {NodeDefinition} node - Node definition.
 * @property {NodeRunContext} runContext - Node execution context.
 * @property {Record<string, unknown>} input - Resolved input payload.
 */
export interface ExecutorContext {
  registry: NodeRegistry;
  node: NodeDefinition;
  runContext: NodeRunContext;
  input: Record<string, unknown>;
}

/**
 * Node executor interface.
 */
export interface Executor {
  /**
   * Execute a node with the provided context.
   * @param context - Execution context.
   * @returns Execution result.
   */
  runNode(context: ExecutorContext): Promise<NodeExecutionResult>;
}

/** Default executor implementation. */
export declare class DefaultExecutor implements Executor {
  /**
   * Execute a node with the provided context.
   * @param context - Execution context.
   * @returns Execution result.
   */
  runNode(context: ExecutorContext): Promise<NodeExecutionResult>;
}
