import type { UIMessageChunk } from "ai";
import type { RuntimeEvent } from "../../state";

/**
 * Configuration options for OpenHarnessChatTransport.
 */
export interface OpenHarnessChatTransportOptions {
  /**
   * Include reasoning/thinking parts in the message stream.
   * Maps `agent:thinking:delta` events to `reasoning-delta` chunks.
   * @default true
   */
  sendReasoning?: boolean;

  /**
   * Include step-start parts at node boundaries.
   * Maps `node:start` events to `step-start` chunks.
   * @default true
   */
  sendStepMarkers?: boolean;

  /**
   * Include custom data parts for flow-level events (paused, complete, etc).
   * Maps `flow:*` events to `data-flow-status` chunks.
   * @default false
   */
  sendFlowMetadata?: boolean;

  /**
   * Include custom data parts for node outputs.
   * Maps `node:complete` events to `data-node-output` chunks.
   * @default false
   */
  sendNodeOutputs?: boolean;

  /**
   * Custom message ID generator.
   * @default crypto.randomUUID
   */
  generateMessageId?: () => string;
}

/**
 * Open Harness-specific data part types.
 * Used when sendFlowMetadata or sendNodeOutputs are enabled.
 */
export interface OpenHarnessDataTypes {
  "flow-status": FlowStatusData;
  "node-output": NodeOutputData;
}

/**
 * Flow status data for data-flow-status parts.
 */
export interface FlowStatusData {
  status: "running" | "paused" | "complete" | "aborted";
  flowName: string;
}

/**
 * Node output data for data-node-output parts.
 */
export interface NodeOutputData {
  nodeId: string;
  runId: string;
  output: unknown;
}

/**
 * Transform a single RuntimeEvent into zero or more UIMessageChunks.
 */
export type TransformFunction = (
  event: RuntimeEvent,
  tracker: PartTracker,
  messageId: string,
  options: Required<OpenHarnessChatTransportOptions>,
) => UIMessageChunk[];

/**
 * Minimal state for detecting "first delta" to emit *-start chunks.
 *
 * Why this exists: AI SDK expects `text-start` before any `text-delta`.
 * We only get `agent:text:delta` events (no explicit start event).
 * So we track whether we've seen the first delta to emit start + delta together.
 *
 * This is NOT an accumulator. The AI SDK accumulates chunks into messages.
 * We just need to know "have I emitted start yet?"
 */
export interface PartTracker {
  /** Whether `text-start` has been emitted */
  textStarted: boolean;
  /** Whether `text-end` has been emitted */
  textEnded: boolean;
  /** Whether `reasoning-start` has been emitted */
  reasoningStarted: boolean;
}
