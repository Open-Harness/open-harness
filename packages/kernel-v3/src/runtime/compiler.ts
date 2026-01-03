import type { EdgeDefinition, FlowDefinition, NodeDefinition } from "../core/types.js";

export type CompiledFlow = {
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
  adjacency: Map<string, string[]>;
  incoming: Map<string, EdgeDefinition[]>;
};

export interface Compiler {
  compile(definition: FlowDefinition): CompiledFlow;
}

export declare class GraphCompiler implements Compiler {
  compile(definition: FlowDefinition): CompiledFlow;
}

export declare function parseFlowYaml(source: string): FlowDefinition;
export declare function validateFlowDefinition(input: unknown): FlowDefinition;
