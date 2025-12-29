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
import { createContainer, IAgentRunnerToken, IUnifiedEventBusToken, setMonologueContainer } from "@openharness/sdk";
import { AnthropicRunner } from "../infra/runner/anthropic-runner.js";
import { setDecoratorContainer } from "../infra/recording/decorators.js";
import { AgentBuilder } from "./builder.js";
import { registerAnthropicProvider } from "./factory.js";
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

// ============================================================================
// Shared Container Resolution Helpers (T010)
// ============================================================================

/**
 * Create a temporary container for standalone agent execution.
 *
 * Binds AnthropicRunner and AgentBuilder with proper DI setup.
 * Sets decorator containers for @Record and @Monologue compatibility.
 *
 * @returns Configured container ready for agent execution
 * @internal
 */
function createTemporaryContainer(): Container {
	const container = createContainer({ mode: "live" });

	// Set decorator containers for @Record and @Monologue compatibility
	setDecoratorContainer(container);
	setMonologueContainer(container);

	// Bind AnthropicRunner
	container.bind({
		provide: IAgentRunnerToken,
		useClass: AnthropicRunner,
	});

	// Bind AgentBuilder
	container.bind({
		provide: AgentBuilder,
		useClass: AgentBuilder,
	});

	return container;
}

/**
 * Resolve AgentBuilder from container (creates temporary if needed).
 *
 * Handles container resolution logic:
 * 1. If options.container provided, use it
 * 2. Otherwise, create temporary container
 * 3. Resolve AgentBuilder from container
 *
 * @param options - Execution options (may include container)
 * @returns AgentBuilder instance
 * @internal
 */
function resolveAgentBuilder<TOutput>(options?: AgentExecutionOptions<TOutput> | AgentStreamOptions<TOutput>): {
	builder: AgentBuilder;
	container: Container;
} {
	// Use provided container or create temporary
	const container = options?.container ?? createTemporaryContainer();

	// Resolve AgentBuilder from container
	const builder = container.get(AgentBuilder);

	return { builder, container };
}

// ============================================================================
// Public Execution Helpers
// ============================================================================

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
export async function executeAgent<TInput, TOutput>(
	definition: AnthropicAgentDefinition<TInput, TOutput>,
	input: TInput,
	options?: AgentExecutionOptions<TOutput>,
): Promise<TOutput> {
	// Resolve builder (creates temporary container if needed)
	const { builder } = resolveAgentBuilder(options);

	// Build executable agent from definition
	const agent = builder.build(definition);

	// Execute and return result
	return agent.execute(input, options);
}

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
export function streamAgent<TInput, TOutput>(
	definition: AnthropicAgentDefinition<TInput, TOutput>,
	input: TInput,
	options?: AgentStreamOptions<TOutput>,
): AgentHandle<TOutput> {
	// Resolve builder (creates temporary container if needed)
	const { builder } = resolveAgentBuilder(options);

	// Build executable agent from definition
	const agent = builder.build(definition);

	// Stream and return handle
	return agent.stream(input, options);
}
