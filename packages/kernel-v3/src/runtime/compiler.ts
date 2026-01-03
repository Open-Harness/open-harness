import type { EdgeDefinition, FlowDefinition, NodeDefinition } from "../core/types.js";

/**
 * Compiled representation of a flow.
 *
 * @property {NodeDefinition[]} nodes - Nodes in definition order.
 * @property {EdgeDefinition[]} edges - Edges in definition order.
 * @property {Map<string, string[]>} adjacency - Outgoing adjacency list.
 * @property {Map<string, EdgeDefinition[]>} incoming - Incoming edge map.
 */
export type CompiledFlow = {
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
  adjacency: Map<string, string[]>;
  incoming: Map<string, EdgeDefinition[]>;
};

/** Compiler interface for FlowDefinition. */
export interface Compiler {
  /**
   * Compile a flow definition into an internal graph representation.
   * @param definition - Flow definition.
   * @returns Compiled flow.
   */
  compile(definition: FlowDefinition): CompiledFlow;
}

/** Default graph compiler implementation. */
export declare class GraphCompiler implements Compiler {
  /**
   * Compile a flow definition into an internal graph representation.
   * @param definition - Flow definition.
   * @returns Compiled flow.
   */
  compile(definition: FlowDefinition): CompiledFlow;
}

/**
 * Parse YAML into a FlowDefinition.
 * @param source - YAML string.
 * @returns Parsed and validated flow definition.
 */
export declare function parseFlowYaml(source: string): FlowDefinition;

/**
 * Validate an unknown value as a FlowDefinition.
 * @param input - Value to validate.
 * @returns Validated flow definition.
 */
export declare function validateFlowDefinition(input: unknown): FlowDefinition;
