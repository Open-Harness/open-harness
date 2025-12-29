/**
 * Execution Helpers for Anthropic Agents
 *
 * Provides standalone execution functions (executeAgent, streamAgent) that:
 * - Create temporary containers if needed
 * - Resolve AgentBuilder via DI
 * - Build and execute agents from definitions
 *
 * These helpers enable quick standalone execution without harness boilerplate.
 *
 * @module provider/helpers
 */
import type { Container } from "@needle-di/core";
import type { AgentHandle, AnthropicAgentDefinition, ExecuteOptions, StreamOptions } from "./types.js";
/**
 * Options for executeAgent() and streamAgent() with optional container.
 */
export interface AgentExecutionOptions<TOutput> extends ExecuteOptions<TOutput> {
    /**
     * Optional container to use for agent execution.
     * If not provided, a temporary container will be created automatically.
     *
     * **Use cases**:
     * - Testing with mock dependencies (inject mock runner/bus)
     * - Sharing container across multiple agent calls
     * - Custom DI configuration
     */
    container?: Container;
}
/**
 * Options for streamAgent() with optional container.
 */
export interface AgentStreamOptions<TOutput> extends StreamOptions<TOutput> {
    /**
     * Optional container to use for agent execution.
     * If not provided, a temporary container will be created automatically.
     */
    container?: Container;
}
/**
 * Execute an agent definition standalone (without harness).
 *
 * Creates a temporary container, builds the agent, and executes it.
 * This is the simplest way to run an agent for quick experimentation.
 *
 * **Container Management**:
 * - Default: Creates temporary container (discarded after execution)
 * - Custom: Pass `options.container` for testing or shared execution
 *
 * @param definition - Agent configuration from defineAnthropicAgent()
 * @param input - Input data matching agent's inputSchema
 * @param options - Optional execution options (callbacks, container, etc.)
 * @returns Promise resolving to typed output
 *
 * @example
 * ```typescript
 * import { defineAnthropicAgent, executeAgent } from "@openharness/anthropic";
 * import { z } from "zod";
 *
 * const MyAgent = defineAnthropicAgent({
 *   name: "MyAgent",
 *   prompt: "Task: {{task}}",
 *   inputSchema: z.object({ task: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 * });
 *
 * // Simple execution (temporary container)
 * const output = await executeAgent(MyAgent, { task: "Hello" });
 *
 * // With custom container (for testing)
 * const container = createContainer();
 * container.bind({ provide: IAgentRunnerToken, useValue: mockRunner });
 * const result = await executeAgent(MyAgent, { task: "Test" }, { container });
 * ```
 */
export declare function executeAgent<TInput, TOutput>(definition: AnthropicAgentDefinition<TInput, TOutput>, input: TInput, options?: AgentExecutionOptions<TOutput>): Promise<TOutput>;
/**
 * Stream an agent definition standalone (without harness).
 *
 * Creates a temporary container, builds the agent, and returns a streaming handle.
 * Use this for interactive agents with real-time updates.
 *
 * **Container Management**:
 * - Default: Creates temporary container (discarded after execution)
 * - Custom: Pass `options.container` for testing or shared execution
 *
 * @param definition - Agent configuration from defineAnthropicAgent()
 * @param input - Input data matching agent's inputSchema
 * @param options - Optional streaming options (callbacks, container, etc.)
 * @returns AgentHandle with interrupt/streamInput/setModel/result
 *
 * @example
 * ```typescript
 * import { defineAnthropicAgent, streamAgent } from "@openharness/anthropic";
 * import { z } from "zod";
 *
 * const MyAgent = defineAnthropicAgent({
 *   name: "MyAgent",
 *   prompt: "Task: {{task}}",
 *   inputSchema: z.object({ task: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 * });
 *
 * // Stream with callbacks
 * const handle = streamAgent(MyAgent, { task: "Hello" }, {
 *   callbacks: {
 *     onText: (text) => console.log("Text:", text),
 *     onComplete: (result) => console.log("Done:", result),
 *   },
 * });
 *
 * // Wait for result
 * const output = await handle.result;
 * ```
 */
export declare function streamAgent<TInput, TOutput>(definition: AnthropicAgentDefinition<TInput, TOutput>, input: TInput, options?: AgentStreamOptions<TOutput>): AgentHandle<TOutput>;
