/**
 * Contract: Vercel AI SDK Adapter Types
 *
 * This file defines the public API contract for the @open-harness/ai-sdk package.
 * Implementation MUST conform to these interfaces.
 *
 * Branch: 001-vercel-ai-adapter
 * Date: 2025-01-05
 */

import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import type { Runtime, RuntimeEvent } from "@open-harness/sdk";

// =============================================================================
// Transport Options
// =============================================================================

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

// =============================================================================
// Main Transport Class
// =============================================================================

/**
 * ChatTransport implementation for Open Harness runtime.
 *
 * Transforms Open Harness runtime events into AI SDK UIMessageChunks,
 * enabling seamless integration with `useChat()` hook.
 *
 * @example
 * ```tsx
 * import { useChat } from '@ai-sdk/react';
 * import { OpenHarnessChatTransport } from '@open-harness/ai-sdk';
 * import { createHarness } from '@open-harness/sdk';
 *
 * const harness = createHarness({ flow: myFlow });
 *
 * function Chat() {
 *   const { messages, input, handleSubmit } = useChat({
 *     transport: new OpenHarnessChatTransport(harness.runtime),
 *   });
 *   // ...
 * }
 * ```
 */
export interface IOpenHarnessChatTransport extends ChatTransport<UIMessage> {
  /**
   * Send messages to the Open Harness runtime.
   * Extracts the last user message and dispatches it as a command.
   * Returns a stream of UIMessageChunks as events arrive.
   */
  sendMessages(options: {
    trigger: "submit-message" | "regenerate-message";
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal: AbortSignal;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    metadata?: unknown;
  }): Promise<ReadableStream<UIMessageChunk>>;

  /**
   * Reconnect to an existing stream.
   * @returns null - reconnection not supported in initial implementation
   */
  reconnectToStream(options: {
    chatId: string;
    abortSignal: AbortSignal;
  }): Promise<ReadableStream<UIMessageChunk> | null>;
}

// =============================================================================
// Transform Functions
// =============================================================================

/**
 * Transform a single RuntimeEvent into zero or more UIMessageChunks.
 *
 * @param event - Open Harness runtime event
 * @param context - Transformation context (message ID, accumulator state)
 * @returns Array of UIMessageChunks (may be empty for non-mapped events)
 */
export type TransformFunction = (
  event: RuntimeEvent,
  context: TransformContext
) => UIMessageChunk[];

/**
 * Context passed to transform functions.
 */
export interface TransformContext {
  /** Current message ID */
  messageId: string;
  /** Accumulator for tracking state */
  accumulator: IMessageAccumulator;
  /** Transport options */
  options: Required<OpenHarnessChatTransportOptions>;
}

// =============================================================================
// Message Accumulator
// =============================================================================

/**
 * State machine for tracking message construction.
 */
export interface IMessageAccumulator {
  /** Current message ID */
  readonly messageId: string;

  /** Current text part state */
  readonly textState: PartState;

  /** Current reasoning part state */
  readonly reasoningState: PartState;

  /** Tool states by toolCallId */
  readonly toolStates: ReadonlyMap<string, ToolInvocationState>;

  /** Whether any chunk has been emitted */
  readonly hasEmittedAny: boolean;

  /** Mark text streaming started */
  startText(): void;

  /** Mark text streaming complete */
  endText(): void;

  /** Mark reasoning streaming started */
  startReasoning(): void;

  /** Mark reasoning streaming complete */
  endReasoning(): void;

  /** Track a tool invocation */
  trackTool(toolCallId: string, toolName: string, input: unknown): void;

  /** Mark tool as complete with output */
  completeTool(toolCallId: string, output: unknown): void;

  /** Mark tool as errored */
  errorTool(toolCallId: string, errorText: string): void;
}

/**
 * State of a text or reasoning part.
 */
export type PartState = "idle" | "streaming" | "done";

/**
 * State of a tool invocation.
 */
export interface ToolInvocationState {
  toolCallId: string;
  toolName: string;
  state: "input-available" | "output-available" | "error";
  input: unknown;
  output?: unknown;
  errorText?: string;
}

// =============================================================================
// Custom Data Types
// =============================================================================

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

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an OpenHarnessChatTransport instance.
 *
 * @param runtime - Open Harness runtime instance
 * @param options - Transport configuration
 * @returns ChatTransport instance compatible with useChat()
 */
export declare function createOpenHarnessChatTransport(
  runtime: Runtime,
  options?: OpenHarnessChatTransportOptions
): IOpenHarnessChatTransport;
