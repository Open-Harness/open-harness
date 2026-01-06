import type { UIMessageChunk } from "ai";
import type {
  AgentTextDeltaEventPayload,
  AgentTextEventPayload,
  AgentThinkingDeltaEventPayload,
  AgentThinkingEventPayload,
  AgentToolEventPayload,
  RuntimeEvent,
} from "../../core/events.js";
import type { PartTracker } from "./types.js";

/**
 * Create a new PartTracker with initial state.
 */
export function createPartTracker(): PartTracker {
  return {
    textStarted: false,
    textEnded: false,
    reasoningStarted: false,
  };
}

/**
 * Transform text delta and complete events to text chunks.
 */
export function transformTextEvent(
  event: AgentTextDeltaEventPayload | AgentTextEventPayload,
  tracker: PartTracker,
  messageId: string,
): UIMessageChunk[] {
  const chunks: UIMessageChunk[] = [];

  if (event.type === "agent:text:delta") {
    // Skip empty deltas
    if (!event.content) {
      return chunks;
    }
    if (!tracker.textStarted) {
      chunks.push({ type: "text-start", id: messageId });
      tracker.textStarted = true;
    }
    chunks.push({ type: "text-delta", id: messageId, delta: event.content });
  } else if (event.type === "agent:text") {
    chunks.push({ type: "text-end", id: messageId });
    tracker.textEnded = true;
  }

  return chunks;
}

/**
 * Transform thinking delta and complete events to reasoning chunks.
 */
export function transformReasoningEvent(
  event: AgentThinkingDeltaEventPayload | AgentThinkingEventPayload,
  tracker: PartTracker,
  messageId: string,
  options: { sendReasoning: boolean },
): UIMessageChunk[] {
  if (!options.sendReasoning) {
    return [];
  }

  const chunks: UIMessageChunk[] = [];

  if (event.type === "agent:thinking:delta") {
    if (!tracker.reasoningStarted) {
      chunks.push({ type: "reasoning-start", id: messageId });
      tracker.reasoningStarted = true;
    }
    chunks.push({
      type: "reasoning-delta",
      id: messageId,
      delta: event.content,
    });
  } else if (event.type === "agent:thinking") {
    chunks.push({ type: "reasoning-end", id: messageId });
  }

  return chunks;
}

/**
 * Generate a tool call ID from tool name and runId.
 */
function generateToolCallId(toolName: string, runId: string): string {
  return `${runId}-${toolName}`;
}

/**
 * Transform tool events to tool invocation chunks.
 */
export function transformToolEvent(
  event: AgentToolEventPayload,
  _messageId: string,
): UIMessageChunk[] {
  const toolCallId = generateToolCallId(event.toolName, event.runId);
  const chunks: UIMessageChunk[] = [];

  chunks.push({
    type: "tool-input-available",
    toolCallId,
    toolName: event.toolName,
    input: event.toolInput,
  });

  if (event.error) {
    chunks.push({
      type: "error",
      errorText: event.error,
    });
  } else {
    chunks.push({
      type: "tool-output-available",
      toolCallId,
      output: event.toolOutput,
    });
  }

  return chunks;
}

/**
 * Transform node start events to step-start chunks.
 */
export function transformStepEvent(
  _event: { type: "node:start" },
  options: { sendStepMarkers: boolean },
): UIMessageChunk[] {
  if (!options.sendStepMarkers) {
    return [];
  }

  // Note: step-start is a valid chunk type in AI SDK v6
  return [{ type: "step-start" } as unknown as UIMessageChunk];
}

/**
 * Transform error events to error chunks.
 */
export function transformErrorEvent(
  event:
    | { type: "agent:error"; message?: string; error?: string }
    | { type: "node:error"; error: string }
    | { type: "agent:aborted"; reason?: string },
): UIMessageChunk[] {
  let errorText = "";

  if (event.type === "agent:error") {
    errorText = event.message || event.error || "An error occurred";
  } else if (event.type === "node:error") {
    errorText = event.error || "An error occurred";
  } else if (event.type === "agent:aborted") {
    errorText = event.reason || "Agent execution was aborted";
  }

  return [{ type: "error", errorText }];
}

/**
 * Main transform function that routes events to specific transforms.
 */
export function transformEvent(
  event: RuntimeEvent,
  tracker: PartTracker,
  messageId: string,
  options: Required<{
    sendReasoning: boolean;
    sendStepMarkers: boolean;
    sendFlowMetadata: boolean;
    sendNodeOutputs: boolean;
    generateMessageId: () => string;
  }>,
): UIMessageChunk[] {
  switch (event.type) {
    case "agent:text:delta":
    case "agent:text":
      return transformTextEvent(event, tracker, messageId);

    case "agent:thinking:delta":
    case "agent:thinking":
      return transformReasoningEvent(event, tracker, messageId, {
        sendReasoning: options.sendReasoning,
      });

    case "agent:tool":
      return transformToolEvent(event, messageId);

    case "node:start":
      return transformStepEvent(event, {
        sendStepMarkers: options.sendStepMarkers,
      });

    case "agent:error":
    case "node:error":
    case "agent:aborted":
      return transformErrorEvent(event);

    default:
      return [];
  }
}
