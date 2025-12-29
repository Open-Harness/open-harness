/**
 * AgentBuilder - Injectable service for constructing executable agents
 *
 * Follows the builder pattern to separate agent configuration (AnthropicAgentDefinition)
 * from agent execution (ExecutableAgent). Uses dependency injection to provide
 * clean testing and composition.
 *
 * @module provider/builder
 */
import type { IAgentRunner, IUnifiedEventBus } from "@openharness/sdk";
import type { AnthropicAgentDefinition, ExecutableAgent } from "./types.js";
/**
 * Injectable agent builder service.
 *
 * Constructs ExecutableAgent instances from plain AnthropicAgentDefinition configs.
 * Uses injected dependencies (IAgentRunner, IUnifiedEventBus) for execution.
 *
 * **Design Principles** (per NeedleDI rubrics):
 * - Constructor injection only (no service locator)
 * - Stateless (safe to call build() multiple times)
 * - Abstraction dependencies (uses tokens, not concrete classes)
 * - Single responsibility (builds agents, nothing else)
 * - Testable without infrastructure (can inject mocks)
 *
 * @injectable
 */
export declare class AgentBuilder {
    private readonly runner;
    private readonly bus;
    /**
     * Inject dependencies via constructor.
     *
     * @param runner - LLM execution service (injected via IAgentRunnerToken)
     * @param bus - Event bus for lifecycle events (injected via IUnifiedEventBusToken, optional)
     */
    constructor(runner?: IAgentRunner, bus?: IUnifiedEventBus | null);
    /**
     * Build an executable agent from a definition.
     *
     * Creates an ExecutableAgent with execute() and stream() methods that:
     * 1. Validate input against definition.inputSchema
     * 2. Render prompt template with validated input
     * 3. Call injected runner with prompt and options
     * 4. Emit events to injected bus
     * 5. Parse and validate output
     *
     * @param definition - Plain agent configuration (from defineAnthropicAgent)
     * @returns Executable agent with execute/stream methods
     *
     * @example
     * ```typescript
     * const builder = container.get(IAgentBuilderToken);
     * const agent = builder.build(PlannerAgent);
     * const result = await agent.execute({ prd: "Build TODO app" });
     * ```
     */
    build<TInput, TOutput>(definition: AnthropicAgentDefinition<TInput, TOutput>): ExecutableAgent<TInput, TOutput>;
}
