/**
 * API Contract: Helper Functions
 *
 * Standalone execution helpers that create temporary containers
 * and build agents for one-off execution.
 */

import type { Container } from "@needle-di/core";
import type { AnthropicAgentDefinition } from "./agent-definition";
import type { AgentHandle, ExecuteOptions, StreamOptions } from "./execution-options";

/**
 * Execute an agent definition standalone.
 *
 * Creates temporary container if none provided in options.
 * Registers Anthropic provider, builds agent, executes, returns result.
 *
 * @param definition - Agent configuration (from defineAnthropicAgent)
 * @param input - Input data matching definition's inputSchema
 * @param options - Optional execution options (container, channel, etc.)
 * @returns Promise resolving to typed output
 *
 * @throws {ZodError} If input validation fails
 * @throws {Error} If execution fails
 *
 * @example
 * ```typescript
 * import { PlannerAgent, executeAgent } from "@openharness/anthropic/presets";
 *
 * const result = await executeAgent(PlannerAgent, {
 *   prd: "Build a TODO app with add, complete, delete"
 * });
 *
 * console.log(result.tasks);
 * ```
 *
 * @example With channel
 * ```typescript
 * const channel = new ConsoleChannel();
 * const result = await executeAgent(
 *   PlannerAgent,
 *   { prd: "..." },
 *   { channel }
 * );
 * ```
 *
 * @example With test container
 * ```typescript
 * const testContainer = createContainer();
 * testContainer.bind({ provide: IAgentRunnerToken, useValue: mockRunner });
 *
 * const result = await executeAgent(
 *   PlannerAgent,
 *   { prd: "..." },
 *   { container: testContainer }
 * );
 * ```
 */
export declare function executeAgent<TInput, TOutput>(
  definition: AnthropicAgentDefinition<TInput, TOutput>,
  input: TInput,
  options?: ExecuteOptions<TOutput>,
): Promise<TOutput>;

/**
 * Stream an agent definition execution.
 *
 * Similar to executeAgent but returns handle for consuming chunks.
 *
 * @param definition - Agent configuration
 * @param input - Input data
 * @param options - Optional stream options
 * @returns AgentHandle for iteration and cancellation
 *
 * @throws {ZodError} If input validation fails
 * @throws {Error} If stream initialization fails
 *
 * @example
 * ```typescript
 * import { PlannerAgent, streamAgent } from "@openharness/anthropic/presets";
 *
 * const handle = streamAgent(PlannerAgent, {
 *   prd: "Build TODO app"
 * });
 *
 * for await (const chunk of handle) {
 *   process.stdout.write(chunk);
 * }
 * ```
 *
 * @example With cancellation
 * ```typescript
 * const handle = streamAgent(PlannerAgent, { prd: "..." });
 *
 * setTimeout(() => handle.cancel(), 5000); // Cancel after 5s
 *
 * try {
 *   for await (const chunk of handle) {
 *     console.log(chunk);
 *   }
 * } catch (err) {
 *   console.log("Stream cancelled");
 * }
 * ```
 */
export declare function streamAgent<TInput, TOutput>(
  definition: AnthropicAgentDefinition<TInput, TOutput>,
  input: TInput,
  options?: StreamOptions<TOutput>,
): AgentHandle<TOutput>;

/**
 * Internal helper: Create and configure temporary container.
 *
 * Used by executeAgent/streamAgent when no container provided.
 * Registers Anthropic provider automatically.
 *
 * @internal
 * @returns Configured container with Anthropic provider registered
 */
export declare function createTemporaryContainer(): Container;
