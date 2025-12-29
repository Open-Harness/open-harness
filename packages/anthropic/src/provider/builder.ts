/**
 * AgentBuilder - Injectable service for constructing executable agents
 *
 * Follows the builder pattern to separate agent configuration (AnthropicAgentDefinition)
 * from agent execution (ExecutableAgent). Uses dependency injection to provide
 * clean testing and composition.
 *
 * @module provider/builder
 */

import { inject, injectable } from "@needle-di/core";
import type { IAgentRunner, IUnifiedEventBus } from "@openharness/sdk";
import { IAgentRunnerToken, IUnifiedEventBusToken } from "@openharness/sdk";
import { randomUUID } from "node:crypto";
import { zodToSdkSchema } from "../infra/runner/models.js";
import { wrapWithMonologue, wrapWithRecording } from "./factory.js";
import { InternalAnthropicAgent } from "./internal-agent.js";
import type {
	AgentHandle,
	AnthropicAgentDefinition,
	ExecutableAgent,
	ExecuteOptions,
	PromptTemplate,
	StreamOptions,
} from "./types.js";

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
@injectable()
export class AgentBuilder {
	/**
	 * Inject dependencies via constructor.
	 *
	 * @param runner - LLM execution service (injected via IAgentRunnerToken)
	 * @param bus - Event bus for lifecycle events (injected via IUnifiedEventBusToken, optional)
	 */
	constructor(
		private readonly runner: IAgentRunner = inject(IAgentRunnerToken),
		private readonly bus: IUnifiedEventBus | null = inject(IUnifiedEventBusToken, { optional: true }) ?? null,
	) {}

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
	build<TInput, TOutput>(definition: AnthropicAgentDefinition<TInput, TOutput>): ExecutableAgent<TInput, TOutput> {
		const { name, prompt, inputSchema, outputSchema, options: sdkOptions, recording, monologue } = definition;

		// Create internal agent using injected dependencies
		const internalAgent = new InternalAnthropicAgent(name, this.runner, this.bus);

		// Convert output schema to SDK format once
		// biome-ignore lint/suspicious/noExplicitAny: outputSchema is validated at runtime
		const outputFormat = zodToSdkSchema(outputSchema as any);

		/**
		 * Render prompt from template or static string.
		 */
		const renderPrompt = (input: TInput, overrideTemplate?: PromptTemplate<unknown>): string => {
			const template = overrideTemplate ?? prompt;

			if (typeof template === "string") {
				return template;
			}

			// PromptTemplate - render with input data
			return template.render(input as unknown as Record<string, unknown>);
		};

		/**
		 * Core execute implementation.
		 */
		const executeCore = async (input: TInput, execOptions?: ExecuteOptions<TOutput>): Promise<TOutput> => {
			// Validate input
			const parseResult = inputSchema.safeParse(input);
			if (!parseResult.success) {
				throw new Error(`Input validation failed: ${parseResult.error.message}`);
			}

			// Render prompt
			const renderedPrompt = renderPrompt(parseResult.data, execOptions?.prompt);

			// Generate session ID if not provided
			const sessionId = execOptions?.sessionId ?? randomUUID();

			// Run agent using injected runner and bus
			return internalAgent.run<TOutput>(renderedPrompt, sessionId, {
				...(sdkOptions as Record<string, unknown>),
				outputFormat,
				callbacks: execOptions?.callbacks,
				timeoutMs: execOptions?.timeoutMs,
			});
		};

		// Apply recording and monologue wrappers
		let executeFn = executeCore;
		executeFn = wrapWithRecording(executeFn, recording, name);
		executeFn = wrapWithMonologue(executeFn, monologue, name);

		/**
		 * Execute agent and await result.
		 */
		const execute = async (input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput> => {
			return executeFn(input, options);
		};

		/**
		 * Stream agent with interaction handle.
		 */
		const stream = (input: TInput, options?: StreamOptions<TOutput>): AgentHandle<TOutput> => {
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
		};

		// Return ExecutableAgent (no name field - stateless)
		return {
			execute,
			stream,
		};
	}
}
