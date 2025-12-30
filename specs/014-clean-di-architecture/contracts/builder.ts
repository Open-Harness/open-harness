/**
 * API Contract: AgentBuilder
 *
 * Injectable service that constructs ExecutableAgent instances
 * from AnthropicAgentDefinition configurations.
 */

import type { IAgentRunner, IUnifiedEventBus } from "@openharness/sdk";
import type { AnthropicAgentDefinition } from "./agent-definition";
import type { ExecutableAgent } from "./executable-agent";

/**
 * Injectable agent builder service.
 *
 * Constructs executable agents from plain config objects.
 * Uses injected dependencies (runner, event bus) for execution.
 *
 * @injectable
 */
export interface IAgentBuilder {
  /**
   * Build an executable agent from a definition.
   *
   * @param definition - Plain agent configuration
   * @returns Executable agent with execute/stream methods
   *
   * @throws {Error} If definition is invalid
   *
   * @example
   * ```typescript
   * @injectable()
   * class AgentBuilder implements IAgentBuilder {
   *   constructor(
   *     private runner = inject(IAgentRunnerToken),
   *     private bus = inject(IUnifiedEventBusToken),
   *   ) {}
   *
   *   build<TIn, TOut>(
   *     definition: AnthropicAgentDefinition<TIn, TOut>
   *   ): ExecutableAgent<TIn, TOut> {
   *     return {
   *       execute: async (input, options) => {
   *         const validated = definition.inputSchema.parse(input);
   *         const prompt = definition.prompt.render(validated);
   *         const result = await this.runner.run(prompt, definition.outputSchema);
   *         return result;
   *       },
   *       stream: (input, options) => {
   *         // Similar but streaming
   *       },
   *     };
   *   }
   * }
   * ```
   */
  build<TInput, TOutput>(
    definition: AnthropicAgentDefinition<TInput, TOutput>,
  ): ExecutableAgent<TInput, TOutput>;
}

/**
 * Injection token for AgentBuilder.
 *
 * Use this token to inject the builder in services or tests.
 *
 * @example
 * ```typescript
 * @injectable()
 * class MyService {
 *   constructor(private builder = inject(IAgentBuilderToken)) {}
 *
 *   async run(definition: AnthropicAgentDefinition<any, any>) {
 *     const agent = this.builder.build(definition);
 *     return agent.execute({...});
   *   }
 * }
 * ```
 */
export const IAgentBuilderToken: InjectionToken<IAgentBuilder>;

/**
 * Registration function for anthropic provider.
 *
 * Binds AnthropicRunner and AgentBuilder to container.
 *
 * @param container - Container to register bindings in
 *
 * @example
 * ```typescript
 * const container = createContainer();
 * registerAnthropicProvider(container);
 *
 * const builder = container.get(IAgentBuilderToken);
 * const agent = builder.build(PlannerAgent);
 * ```
 */
export declare function registerAnthropicProvider(container: Container): void;
