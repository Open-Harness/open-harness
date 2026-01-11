/**
 * Contract: Vercel AI SDK Adapter Types
 *
 * This file defines the public API contract for the @open-harness/ai-sdk package.
 * Implementation MUST conform to these interfaces.
 *
 * Branch: 001-vercel-ai-adapter
 * Date: 2025-01-05
 */

import type { Runtime, RuntimeEvent } from "@open-harness/sdk";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

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
// Part Tracker (Minimal State)
// =============================================================================

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
	/** Whether `reasoning-start` has been emitted */
	reasoningStarted: boolean;
}

/**
 * Create a new PartTracker with initial state.
 */
export declare function createPartTracker(): PartTracker;

// =============================================================================
// Transform Functions
// =============================================================================

/**
 * Transform a single RuntimeEvent into zero or more UIMessageChunks.
 *
 * @param event - Open Harness runtime event
 * @param tracker - Part tracker for detecting first deltas
 * @param messageId - Current message ID for chunks
 * @param options - Transport options
 * @returns Array of UIMessageChunks (may be empty for non-mapped events)
 */
export type TransformFunction = (
	event: RuntimeEvent,
	tracker: PartTracker,
	messageId: string,
	options: Required<OpenHarnessChatTransportOptions>,
) => UIMessageChunk[];

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
	options?: OpenHarnessChatTransportOptions,
): IOpenHarnessChatTransport;
