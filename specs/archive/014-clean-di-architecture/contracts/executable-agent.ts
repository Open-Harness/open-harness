/**
 * API Contract: ExecutableAgent
 *
 * Object returned by AgentBuilder.build() with execute/stream methods.
 * This is what actually runs the agent.
 */

import type { AgentHandle, ExecuteOptions, StreamOptions } from "./execution-options";

/**
 * Executable agent with typed execute and stream methods.
 *
 * Created by AgentBuilder.build() from agent definition.
 * Stateless - can be called multiple times safely.
 *
 * @template TInput - Input data type
 * @template TOutput - Output data type
 */
export interface ExecutableAgent<TInput, TOutput> {
	/**
	 * Execute agent with input and wait for complete output.
	 *
	 * @param input - Input data (validated against inputSchema)
	 * @param options - Optional execution options (channel, container overrides)
	 * @returns Promise resolving to typed output
	 *
	 * @throws {ZodError} If input validation fails
	 * @throws {Error} If execution fails
	 *
	 * @example
	 * ```typescript
	 * const agent = builder.build(PlannerAgent);
	 * const result = await agent.execute(
	 *   { prd: "Build TODO app" },
	 *   { channel: new ConsoleChannel() }
	 * );
	 * console.log(result.tasks);
	 * ```
	 */
	execute(input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput>;

	/**
	 * Execute agent with streaming output.
	 *
	 * @param input - Input data (validated against inputSchema)
	 * @param options - Optional stream options (channel, container overrides)
	 * @returns AgentHandle for consuming chunks and cancelling
	 *
	 * @throws {ZodError} If input validation fails
	 * @throws {Error} If stream initialization fails
	 *
	 * @example
	 * ```typescript
	 * const agent = builder.build(PlannerAgent);
	 * const handle = agent.stream({ prd: "Build TODO app" });
	 *
	 * for await (const chunk of handle) {
	 *   process.stdout.write(chunk);
	 * }
	 * ```
	 */
	stream(input: TInput, options?: StreamOptions<TOutput>): AgentHandle<TOutput>;
}
