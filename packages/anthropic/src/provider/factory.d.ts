/**
 * Agent Factory for @openharness/anthropic
 *
 * Provides the `defineAnthropicAgent()` factory function for creating typed agents.
 * Uses a singleton global container pattern with lazy initialization.
 *
 * @example
 * ```typescript
 * import { defineAnthropicAgent, createPromptTemplate } from "@openharness/anthropic";
 * import { z } from "zod";
 *
 * const MyAgent = defineAnthropicAgent({
 *   name: "MyAgent",
 *   prompt: createPromptTemplate("Do this task: {{task}}"),
 *   inputSchema: z.object({ task: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 * });
 *
 * const output = await MyAgent.execute({ task: "Hello" });
 * ```
 *
 * @module provider/factory
 */
import type { Container } from "@needle-di/core";
import type { AnthropicAgentDefinition, ExecuteOptions } from "./types.js";
/**
 * Register Anthropic provider in a container.
 *
 * Binds AnthropicRunner to IAgentRunnerToken and AgentBuilder for agent execution.
 * This is called by helpers (executeAgent/streamAgent) and harness to set up DI.
 *
 * @param container - Container to register provider in
 */
export declare function registerAnthropicProvider(container: Container): void;
/**
 * Wrap an execute function with recording support.
 *
 * This applies the same logic as the @Record decorator but as a higher-order function.
 *
 * @param fn - The original execute function
 * @param options - Recording options (enabled, vaultPath)
 * @param agentName - Agent name for recording metadata
 * @returns Wrapped function with recording
 */
export declare function wrapWithRecording<TInput, TOutput>(fn: (input: TInput, options?: ExecuteOptions<TOutput>) => Promise<TOutput>, recordingOptions: {
    enabled?: boolean;
    vaultPath?: string;
} | undefined, _agentName: string): (input: TInput, options?: ExecuteOptions<TOutput>) => Promise<TOutput>;
/**
 * Wrap an execute function with monologue support.
 *
 * This applies the same logic as the @Monologue decorator but as a higher-order function.
 *
 * @param fn - The original execute function
 * @param options - Monologue options (enabled, scope)
 * @param agentName - Agent name for monologue context
 * @returns Wrapped function with monologue
 */
export declare function wrapWithMonologue<TInput, TOutput>(fn: (input: TInput, options?: ExecuteOptions<TOutput>) => Promise<TOutput>, monologueOptions: {
    enabled?: boolean;
    scope?: string;
} | undefined, _agentName: string): (input: TInput, options?: ExecuteOptions<TOutput>) => Promise<TOutput>;
/**
 * Create a typed Anthropic agent.
 *
 * This is the main entry point for creating agents with the factory pattern.
 * It returns an agent object with `.execute()` and `.stream()` methods.
 *
 * @example
 * ```typescript
 * const MyAgent = defineAnthropicAgent({
 *   name: "MyCoder",
 *   prompt: createPromptTemplate("Write code for: {{task}}"),
 *   inputSchema: z.object({ task: z.string() }),
 *   outputSchema: z.object({ code: z.string() }),
 * });
 *
 * // Execute with typed input/output
 * const result = await MyAgent.execute({ task: "Hello world" });
 * console.log(result.code);
 *
 * // Stream with interaction handle
 * const handle = MyAgent.stream({ task: "Complex task" });
 * handle.interrupt(); // Cancel if needed
 * const result = await handle.result;
 * ```
 *
 * @param definition - Agent configuration
 * @returns Agent object with execute() and stream() methods
 */
/**
 * Define an Anthropic agent with typed inputs and outputs.
 *
 * Returns a plain configuration object (AnthropicAgentDefinition).
 * To execute the agent, use executeAgent() or streamAgent() helpers,
 * or pass the definition to AgentBuilder.build() in a harness.
 *
 * **Builder Pattern** (eliminates global container anti-pattern):
 * - This function returns ONLY configuration (no execute/stream methods)
 * - Execution happens via executeAgent(definition, input) or harness
 * - AgentBuilder constructs executable agents from definitions
 * - No global state, clean DI, fully testable
 *
 * @param definition - Agent configuration with name, prompt, schemas
 * @returns Plain configuration object (pass to executeAgent or builder)
 *
 * @example
 * ```typescript
 * // Define agent (returns config, not executable)
 * const MyAgent = defineAnthropicAgent({
 *   name: "MyAgent",
 *   prompt: "Do this task: {{task}}",
 *   inputSchema: z.object({ task: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 * });
 *
 * // Execute using helper (creates temporary container)
 * const output = await executeAgent(MyAgent, { task: "Hello" });
 *
 * // Or use in harness (harness manages container)
 * const harness = defineHarness({
 *   agents: { myAgent: MyAgent },
 *   // ...
 * });
 * ```
 */
export declare function defineAnthropicAgent<TInput, TOutput>(definition: AnthropicAgentDefinition<TInput, TOutput>): AnthropicAgentDefinition<TInput, TOutput> & {
    __builder?: unknown;
    __registerProvider?: unknown;
};
export { executeAgent, streamAgent } from "./helpers.js";
