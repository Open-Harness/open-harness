/**
 * API Contract: Execution Options
 *
 * Options passed to execute/stream methods and helper functions.
 */

import type { Container } from "@needle-di/core";
import type { IChannel } from "@openharness/sdk";
import type { PromptTemplate } from "./prompt-template";

/**
 * Recording options for agent execution.
 */
export interface RecordingOptions {
	/**
	 * Enable recording of agent interactions.
	 */
	enabled: boolean;

	/**
	 * Path to recording vault directory.
	 * Defaults to ./recordings if not specified.
	 */
	vaultPath?: string;
}

/**
 * Monologue options for context management.
 */
export interface MonologueOptions {
	/**
	 * Enable monologue context tracking.
	 */
	enabled: boolean;

	/**
	 * Scope for monologue context isolation.
	 */
	scope?: string;
}

/**
 * Options for agent execution.
 *
 * @template TOutput - Expected output type
 */
export interface ExecuteOptions<TOutput = unknown> {
	/**
	 * Optional custom container for dependency injection.
	 *
	 * Mainly used for testing with mock dependencies.
	 * If not provided, helpers create temporary container.
	 *
	 * @example
	 * ```typescript
	 * const testContainer = createContainer();
	 * testContainer.bind({ provide: IAgentRunnerToken, useValue: mockRunner });
	 *
	 * const result = await executeAgent(agent, input, { container: testContainer });
	 * ```
	 */
	container?: Container;

	/**
	 * Optional channel for receiving progress events.
	 *
	 * Events emitted:
	 * - agent:start - Execution started
	 * - agent:chunk - Streaming chunk received
	 * - agent:complete - Execution completed
	 * - agent:error - Execution failed
	 *
	 * @example
	 * ```typescript
	 * const channel = new ConsoleChannel();
	 * const result = await executeAgent(agent, input, { channel });
	 * ```
	 */
	channel?: IChannel;

	/**
	 * Optional recording configuration.
	 *
	 * Records agent input/output for replay testing.
	 */
	recording?: RecordingOptions;

	/**
	 * Optional monologue configuration.
	 *
	 * Enables context tracking across agent calls.
	 */
	monologue?: MonologueOptions;

	/**
	 * Optional prompt override.
	 *
	 * Replaces the agent definition's prompt with custom template.
	 * Must have same variable structure as original.
	 *
	 * @example
	 * ```typescript
	 * const customPrompt = createPromptTemplate(`
	 *   Custom instructions: {{prd}}
	 * `);
	 *
	 * const result = await executeAgent(PlannerAgent, { prd: "..." }, {
	 *   prompt: customPrompt
	 * });
	 * ```
	 */
	prompt?: PromptTemplate<any>;
}

/**
 * Options for streaming execution.
 *
 * Same as ExecuteOptions - both use identical configuration.
 */
export type StreamOptions<TOutput = unknown> = ExecuteOptions<TOutput>;

/**
 * Handle returned from streaming execution.
 *
 * Provides async iteration over chunks and cancellation.
 *
 * @template TOutput - Expected output type (parsed from final result)
 */
export interface AgentHandle<TOutput = unknown> {
	/**
	 * Async iterator for consuming streaming chunks.
	 *
	 * Yields string chunks as they arrive from LLM.
	 * Final complete output is parsed against outputSchema.
	 *
	 * @example
	 * ```typescript
	 * for await (const chunk of handle) {
	 *   process.stdout.write(chunk);
	 * }
	 * ```
	 */
	[Symbol.asyncIterator](): AsyncIterator<string>;

	/**
	 * Cancel the streaming request.
	 *
	 * Stops iteration and cleans up resources.
	 * Subsequent iteration throws cancellation error.
	 *
	 * @example
	 * ```typescript
	 * const handle = streamAgent(agent, input);
	 *
	 * setTimeout(() => handle.cancel(), 5000);
	 *
	 * try {
	 *   for await (const chunk of handle) {
	 *     console.log(chunk);
	 *   }
	 * } catch (err) {
	 *   if (err.message.includes('cancelled')) {
	 *     console.log('Stream cancelled by user');
	 *   }
	 * }
	 * ```
	 */
	cancel(): void;

	/**
	 * Wait for complete output (convenience method).
	 *
	 * Consumes entire stream and returns parsed output.
	 * Equivalent to iterating and joining chunks.
	 *
	 * @returns Promise resolving to typed output
	 */
	complete(): Promise<TOutput>;
}
