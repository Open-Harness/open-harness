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
import type { AnthropicAgent, AnthropicAgentDefinition, ExecuteOptions } from "./types.js";
/**
 * Reset the global container. Useful for testing.
 * @internal
 */
export declare function resetFactoryContainer(): void;
/**
 * Set a custom container. Useful for testing or custom setups.
 * @internal
 */
export declare function setFactoryContainer(container: Container): void;
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
export declare function defineAnthropicAgent<TInput, TOutput>(definition: AnthropicAgentDefinition<TInput, TOutput>): AnthropicAgent<TInput, TOutput>;
