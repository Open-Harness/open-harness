/**
 * Provider abstractions for AI provider integration.
 *
 * This module provides:
 * - ProviderTrait: Interface that all providers implement
 * - ExecutionContext: Minimal context passed to providers
 * - StreamEvent: Unified event types
 * - ProviderError: Structured error types
 * - toNodeDefinition: Adapter to convert trait to NodeTypeDefinition
 *
 * @example
 * ```typescript
 * const myTrait: ProviderTrait<MyInput, MyOutput> = {
 *   type: "my.provider",
 *   displayName: "My Provider",
 *   capabilities: { streaming: true, pauseResume: false, structuredOutput: false },
 *   inputSchema: MyInputSchema,
 *   outputSchema: MyOutputSchema,
 *   async *execute(input, ctx) {
 *     // Yield events
 *     yield { type: "text", content: "Hello", delta: true };
 *     // Return final output
 *     return { text: "Hello World" };
 *   },
 * };
 *
 * const myNode = toNodeDefinition(myTrait);
 * registry.register(myNode);
 * ```
 */

export * from "./adapter.js";
export * from "./context.js";
export * from "./errors.js";
export * from "./events.js";
export * from "./trait.js";
