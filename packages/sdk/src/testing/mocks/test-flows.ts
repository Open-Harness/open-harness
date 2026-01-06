import type { FlowDefinition } from "@internal/state";

/**
 * Create a simple test flow with basic nodes.
 */
export function createTestFlow(options: {
  name?: string;
  nodes?: Array<{
    id: string;
    type: string;
    input?: Record<string, unknown>;
  }>;
  edges?: Array<{
    from: string;
    to: string;
    when?: string;
  }>;
}): FlowDefinition {
  return {
    name: options.name ?? "test-flow",
    nodes:
      options.nodes?.map((node) => ({
        id: node.id,
        type: node.type,
        input: node.input ?? {},
      })) ?? [],
    edges:
      options.edges?.map((edge) => ({
        from: edge.from,
        to: edge.to,
        ...(edge.when && { when: edge.when }),
      })) ?? [],
  };
}
