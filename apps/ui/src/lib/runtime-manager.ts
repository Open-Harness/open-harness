import {
  createClaudeNode,
  createRuntime,
  DefaultNodeRegistry,
  parseFlowYaml,
  type Runtime,
  type RuntimeEvent,
} from "@open-harness/sdk";

// Create flow definition
const flow = parseFlowYaml(`
name: "chat-flow"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: ""
      options:
        model: "claude-haiku-4-5-20251001"
edges: []
`);

// Create Claude node with Haiku model
const claudeNode = createClaudeNode();
const registry = new DefaultNodeRegistry();
registry.register(claudeNode);

// Shared state
export const runtimes = new Map<string, Runtime>();
export const eventStreams = new Map<
  string,
  ReadableStreamDefaultController<Uint8Array>
>();
export const eventBuffers = new Map<string, RuntimeEvent[]>();

export function getRuntime(runId: string): Runtime {
  let rt = runtimes.get(runId);
  if (!rt) {
    const snapshot = {
      runId,
      status: "idle" as const,
      outputs: {},
      state: {},
      nodeStatus: {},
      edgeStatus: {},
      loopCounters: {},
      inbox: [],
      agentSessions: {},
    };
    rt = createRuntime({
      flow,
      registry,
      resume: { snapshot, runId },
    });
    runtimes.set(runId, rt);

    // Subscribe to events and stream them (or buffer if stream not ready)
    rt.onEvent((event: RuntimeEvent) => {
      const stream = eventStreams.get(runId);
      if (stream) {
        // Stream is ready, send event immediately
        const data = `data: ${JSON.stringify(event)}\n\n`;
        try {
          stream.enqueue(new TextEncoder().encode(data));
        } catch (error) {
          // Stream might be closed
          eventStreams.delete(runId);
        }
      } else {
        // Stream not ready yet, buffer the event
        const buffer = eventBuffers.get(runId) ?? [];
        buffer.push(event);
        eventBuffers.set(runId, buffer);
      }
    });
  }
  return rt;
}

export function connectEventStream(runId: string, controller: ReadableStreamDefaultController<Uint8Array>) {
  eventStreams.set(runId, controller);
  
  // Send any buffered events
  const buffer = eventBuffers.get(runId);
  if (buffer) {
    for (const event of buffer) {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      try {
        controller.enqueue(new TextEncoder().encode(data));
      } catch (error) {
        // Stream might be closed
        break;
      }
    }
    eventBuffers.delete(runId);
  }
}
