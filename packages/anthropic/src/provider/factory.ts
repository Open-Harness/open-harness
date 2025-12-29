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

import { randomUUID } from "node:crypto";
import type { Container } from "@needle-di/core";
import type { IAgentRunner, IUnifiedEventBus } from "@openharness/sdk";
import { createContainer, IAgentRunnerToken, IUnifiedEventBusToken, setMonologueContainer } from "@openharness/sdk";
import { AnthropicRunner } from "../infra/runner/anthropic-runner.js";
import { setDecoratorContainer } from "../infra/recording/decorators.js";
import { zodToSdkSchema } from "../infra/runner/models.js";
import { InternalAnthropicAgent } from "./internal-agent.js";
import type {
	AgentHandle,
	AnthropicAgent,
	AnthropicAgentDefinition,
	ExecuteOptions,
	PromptTemplate,
	StreamOptions,
} from "./types.js";

// ============================================================================
// Container Registration
// ============================================================================

/**
 * Register Anthropic provider in a container.
 *
 * Binds AnthropicRunner or ReplayRunner to IAgentRunnerToken based on container mode.
 * Also binds AgentBuilder for agent execution.
 * This is called by helpers (executeAgent/streamAgent) and harness to set up DI.
 *
 * @param container - Container to register provider in
 */
export function registerAnthropicProvider(container: Container): void {
	// Import AgentBuilder and ReplayRunner here to avoid circular dependency at module load time
	// biome-ignore lint/performance/noBarrelFile: sync import after module init
	const { AgentBuilder } = require("./builder.js");
	// biome-ignore lint/performance/noBarrelFile: sync import after module init
	const { ReplayRunner } = require("../infra/recording/replay-runner.js");
	// biome-ignore lint/performance/noBarrelFile: sync import after module init
	const { IConfigToken } = require("@openharness/sdk");

	// Check if we're in replay mode
	const config = container.get(IConfigToken);
	const useReplay = config.isReplayMode === true;

	// Bind appropriate runner based on mode
	container.bind({
		provide: IAgentRunnerToken,
		useClass: useReplay ? ReplayRunner : AnthropicRunner,
	});

	container.bind({
		provide: AgentBuilder,
		useClass: AgentBuilder,
	});
}

// ============================================================================
// Recording Wrapper (T013)
// ============================================================================

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
export function wrapWithRecording<TInput, TOutput>(
	fn: (input: TInput, options?: ExecuteOptions<TOutput>) => Promise<TOutput>,
	recordingOptions: { enabled?: boolean; vaultPath?: string } | undefined,
	_agentName: string,
): (input: TInput, options?: ExecuteOptions<TOutput>) => Promise<TOutput> {
	// If recording is not enabled, return original function
	if (!recordingOptions?.enabled) {
		return fn;
	}

	// Return wrapped function that records execution
	return async (input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput> => {
		// TODO: Implement recording wrapper
		// For now, pass through to original function
		// Full implementation will come in Phase 3 when recording integration is tested
		return fn(input, options);
	};
}

// ============================================================================
// Monologue Wrapper (T013)
// ============================================================================

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
export function wrapWithMonologue<TInput, TOutput>(
	fn: (input: TInput, options?: ExecuteOptions<TOutput>) => Promise<TOutput>,
	monologueOptions: { enabled?: boolean; scope?: string } | undefined,
	_agentName: string,
): (input: TInput, options?: ExecuteOptions<TOutput>) => Promise<TOutput> {
	// If monologue is not enabled, return original function
	if (!monologueOptions?.enabled) {
		return fn;
	}

	// Return wrapped function with monologue
	return async (input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput> => {
		// TODO: Implement monologue wrapper
		// For now, pass through to original function
		// Full implementation will come in Phase 3 when monologue integration is tested
		return fn(input, options);
	};
}

// ============================================================================
// Factory Function
// ============================================================================

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
export function defineAnthropicAgent<TInput, TOutput>(
	definition: AnthropicAgentDefinition<TInput, TOutput>,
): AnthropicAgentDefinition<TInput, TOutput> & { __builder?: unknown; __registerProvider?: unknown } {
	// Import AgentBuilder to attach to definition (for harness lazy resolution)
	// biome-ignore lint/performance/noBarrelFile: sync import after module init
	const { AgentBuilder } = require("./builder.js");

	// Attach builder class and provider registration to definition (014-clean-di-architecture)
	// This allows the harness to build the agent without importing the module
	return {
		...definition,
		__builder: AgentBuilder,
		__registerProvider: registerAnthropicProvider,
	};
}

// Re-export helpers for convenience
export { executeAgent, streamAgent } from "./helpers.js";
