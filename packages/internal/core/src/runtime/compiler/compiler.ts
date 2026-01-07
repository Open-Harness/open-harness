import { parse } from "yaml";
import { ok, err } from "neverthrow";
import type {
  EdgeDefinition,
  EdgeGate,
  FlowDefinition,
  NodeDefinition,
} from "../../state/index.js";
import { FlowDefinitionSchema } from "../../state/index.js";
import {
  CompilationError,
  type CompilationResult,
  wrapCompilationThrow,
} from "./errors.js";

/**
 * Compiled representation of a flow.
 *
 * @property {NodeDefinition[]} nodes - Nodes in definition order.
 * @property {EdgeDefinition[]} edges - Edges in definition order.
 * @property {Map<string, string[]>} adjacency - Outgoing adjacency list.
 * @property {Map<string, EdgeDefinition[]>} incoming - Incoming edge map.
 * @property {Map<string, EdgeGate>} gateByNode - Gate rule per node.
 */
export type CompiledFlow = {
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
  adjacency: Map<string, string[]>;
  incoming: Map<string, EdgeDefinition[]>;
  gateByNode: Map<string, EdgeGate>;
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
export class GraphCompiler implements Compiler {
  /**
   * Compile a flow definition into an internal graph representation.
   * @param definition - Flow definition.
   * @returns Compiled flow.
   */
  compile(definition: FlowDefinition): CompiledFlow {
    const validated = validateFlowDefinition(definition);
    const nodes = validated.nodes;
    const edges = validated.edges;

    const adjacency = new Map<string, string[]>();
    const incoming = new Map<string, EdgeDefinition[]>();
    const gateByNode = new Map<string, EdgeGate>();

    for (const node of nodes) {
      adjacency.set(node.id, []);
      incoming.set(node.id, []);
    }

    for (const edge of edges) {
      const fromList = adjacency.get(edge.from);
      if (fromList) fromList.push(edge.to);

      const inList = incoming.get(edge.to);
      if (inList) inList.push(edge);

      if (edge.gate) {
        const current = gateByNode.get(edge.to);
        if (current && current !== edge.gate) {
          throw new Error(
            `Conflicting gate settings for node "${edge.to}": ${current} vs ${edge.gate}`,
          );
        }
        gateByNode.set(edge.to, edge.gate);
      }
    }

    return { nodes, edges, adjacency, incoming, gateByNode };
  }

  /**
   * Internal Result-based compiler (returns Result<CompiledFlow, CompilationError>).
   * Used internally for error handling patterns.
   *
   * @param definition - Flow definition
   * @returns Result containing compiled flow or CompilationError
   * @internal
   */
  compileResult(definition: FlowDefinition): CompilationResult<CompiledFlow> {
    return wrapCompilationThrow(
      "INVALID_FLOW_DEFINITION",
      () => this.compile(definition),
      { flowName: definition.name },
    );
  }
}

/**
 * Parse YAML into a FlowDefinition.
 * @param source - YAML string.
 * @returns Parsed and validated flow definition.
 */
export function parseFlowYaml(source: string): FlowDefinition {
  const parsed = parse(source) as unknown;
  return validateFlowDefinition(parsed);
}

/**
 * Validate an unknown value as a FlowDefinition.
 * @param input - Value to validate.
 * @returns Validated flow definition.
 */
export function validateFlowDefinition(input: unknown): FlowDefinition {
  return FlowDefinitionSchema.parse(input);
}

/**
 * Create a stable edge key for state maps.
 * @param edge - Edge definition.
 * @returns Edge key string.
 */
export function edgeKey(edge: EdgeDefinition): string {
  return edge.id ?? `${edge.from}->${edge.to}`;
}
