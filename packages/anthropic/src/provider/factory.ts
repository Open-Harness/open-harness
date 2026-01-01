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
// Singleton Container
// ============================================================================

let _globalContainer: Container | null = null;

/**
 * Get or create the global container with lazy initialization.
 *
 * The container is configured for live mode and has decorator containers set up.
 */
function getGlobalContainer(): Container {
	if (!_globalContainer) {
		_globalContainer = createContainer({ mode: "live" });
		// Set decorator containers for @Record and @Monologue compatibility
		setDecoratorContainer(_globalContainer);
		setMonologueContainer(_globalContainer);
		// Register Anthropic provider
		registerAnthropicProvider(_globalContainer);
	}
	return _globalContainer;
}

/**
 * Register Anthropic provider in a container.
 *
 * Binds the AnthropicRunner to IAgentRunnerToken.
 *
 * @param container - Container to register provider in
 */
export function registerAnthropicProvider(container: Container): void {
	container.bind({
		provide: IAgentRunnerToken,
		useClass: AnthropicRunner,
	});
}

/**
 * Reset the global container. Useful for testing.
 * @internal
 */
export function resetFactoryContainer(): void {
	_globalContainer = null;
}

/**
 * Set a custom container. Useful for testing or custom setups.
 * @internal
 */
export function setFactoryContainer(container: Container): void {
	_globalContainer = container;
	setDecoratorContainer(container);
	setMonologueContainer(container);
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
export function defineAnthropicAgent<TInput, TOutput>(
	definition: AnthropicAgentDefinition<TInput, TOutput>,
): AnthropicAgent<TInput, TOutput> {
	const { name, prompt, inputSchema, outputSchema, options: sdkOptions, recording, monologue } = definition;

	// Lazy initialization state - deferred until first execution
	let _internalAgent: InternalAnthropicAgent | null = null;
	let _outputFormat: unknown = null;

	/**
	 * Get or create the internal agent (lazy initialization).
	 * Defers container access until first execution.
	 */
	function getInternalAgent(): InternalAnthropicAgent {
		if (!_internalAgent) {
			// Get or create global container
			const container = getGlobalContainer();

			// Get runner and event bus from container
			const runner = container.get(IAgentRunnerToken) as IAgentRunner;
			const unifiedBus = container.get(IUnifiedEventBusToken, { optional: true }) as IUnifiedEventBus | null;

			// Create internal agent instance
			_internalAgent = new InternalAnthropicAgent(name, runner, unifiedBus);
		}
		return _internalAgent;
	}

	/**
	 * Get or create the output format (lazy initialization).
	 */
	function getOutputFormat(): unknown {
		if (!_outputFormat) {
			// Convert output schema to SDK format
			// Note: zodToSdkSchema expects ZodObject but we accept any ZodType for flexibility
			// biome-ignore lint/suspicious/noExplicitAny: outputSchema is validated at runtime
			_outputFormat = zodToSdkSchema(outputSchema as any);
		}
		return _outputFormat;
	}

	/**
	 * Render prompt from template or static string.
	 */
	function renderPrompt(input: TInput, overrideTemplate?: PromptTemplate<unknown>): string {
		const template = overrideTemplate ?? prompt;

		if (typeof template === "string") {
			return template;
		}

		// PromptTemplate - render with input data
		return template.render(input as unknown as Record<string, unknown>);
	}

	/**
	 * Core execute implementation.
	 */
	async function executeCore(input: TInput, execOptions?: ExecuteOptions<TOutput>): Promise<TOutput> {
		// Validate input
		const parseResult = inputSchema.safeParse(input);
		if (!parseResult.success) {
			throw new Error(`Input validation failed: ${parseResult.error.message}`);
		}

		// Render prompt
		const renderedPrompt = renderPrompt(parseResult.data, execOptions?.prompt);

		// Generate session ID if not provided
		const sessionId = execOptions?.sessionId ?? randomUUID();

		// Run agent (lazily initialized)
		// Note: sdkOptions is Partial<Options> which extends GenericRunnerOptions
		return getInternalAgent().run<TOutput>(renderedPrompt, sessionId, {
			...(sdkOptions as Record<string, unknown>),
			outputFormat: getOutputFormat(),
			callbacks: execOptions?.callbacks,
			timeoutMs: execOptions?.timeoutMs,
		});
	}

	// Apply recording wrapper if enabled
	let executeFn = executeCore;
	executeFn = wrapWithRecording(executeFn, recording, name);
	executeFn = wrapWithMonologue(executeFn, monologue, name);

	/**
	 * Execute agent and await result.
	 */
	async function execute(input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput> {
		return executeFn(input, options);
	}

	/**
	 * Stream agent with interaction handle.
	 *
	 * Note: Streaming is a thin wrapper over execute for now.
	 * Full streaming with interrupt/streamInput/setModel will be implemented
	 * when the SDK supports those features.
	 */
	function stream(input: TInput, options?: StreamOptions<TOutput>): AgentHandle<TOutput> {
		// Create abort controller for interruption
		const abortController = new AbortController();

		// Start execution
		const resultPromise = execute(input, options);

		return {
			interrupt: () => {
				abortController.abort();
			},
			streamInput: (_inputText: string) => {
				// TODO: Implement when SDK supports mid-execution input
				console.warn("streamInput() is not yet implemented");
			},
			setModel: (_model: string) => {
				// TODO: Implement when SDK supports model switching
				console.warn("setModel() is not yet implemented");
			},
			result: resultPromise,
		};
	}

	// Return agent object
	return {
		name,
		execute,
		stream,
	};
}
