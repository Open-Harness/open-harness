/**
 * Factory API Contract for @openharness/anthropic
 *
 * This file defines the public API contract for the defineAnthropicAgent factory.
 * Implementation must match these type signatures exactly.
 *
 * Branch: 013-anthropic-refactor
 * Date: 2025-12-28
 */

import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { AgentResult, IAgentCallbacks, TokenUsage } from "@openharness/sdk";
import type { z } from "zod";

// ============================================================================
// Template Types
// ============================================================================

/**
 * Extract variable names from template string.
 * @example ExtractVars<"Hello {{name}}, your task is {{task}}"> = "name" | "task"
 */
export type ExtractVars<S extends string> = S extends `${string}{{${infer Var}}}${infer Rest}`
	? Var | ExtractVars<Rest>
	: never;

/**
 * Type-safe prompt template with compile-time variable validation.
 */
export interface PromptTemplate<TData> {
	/** The raw template string */
	readonly template: string;

	/** Render the template with typed data */
	render(data: TData): string;

	/** Optional runtime validation */
	validate?(data: unknown): data is TData;
}

// ============================================================================
// Agent Definition
// ============================================================================

/**
 * Configuration for defining an Anthropic agent.
 */
export interface AnthropicAgentDefinition<TInput, TOutput> {
	/** Unique agent identifier */
	name: string;

	/** Prompt template or static string */
	prompt: PromptTemplate<TInput> | string;

	/** Zod schema for input validation */
	inputSchema: z.ZodType<TInput>;

	/** Zod schema for structured output validation */
	outputSchema: z.ZodType<TOutput>;

	/** Optional SDK options passthrough */
	options?: Partial<Options>;

	/** Optional recording configuration */
	recording?: {
		enabled?: boolean;
		vaultPath?: string;
	};

	/** Optional monologue configuration */
	monologue?: {
		enabled?: boolean;
		scope?: string;
	};
}

// ============================================================================
// Execution Options
// ============================================================================

/**
 * Options for agent.execute() method.
 */
export interface ExecuteOptions<TOutput> {
	/** Event callbacks */
	callbacks?: IAgentCallbacks<TOutput>;

	/** Session identifier (auto-generated if omitted) */
	sessionId?: string;

	/** Override prompt template at runtime */
	prompt?: PromptTemplate<unknown>;

	/** Execution timeout in milliseconds */
	timeoutMs?: number;
}

/**
 * Options for agent.stream() method.
 */
export interface StreamOptions<TOutput> extends ExecuteOptions<TOutput> {
	// Streaming-specific options can be added here
}

// ============================================================================
// Agent Handle (Streaming)
// ============================================================================

/**
 * Handle returned by agent.stream() for interaction control.
 */
export interface AgentHandle<TOutput> {
	/** Cancel agent execution */
	interrupt(): void;

	/** Inject additional input mid-execution */
	streamInput(input: string): void;

	/** Change model mid-execution */
	setModel(model: string): void;

	/** Final result promise */
	readonly result: Promise<TOutput>;
}

// ============================================================================
// Agent Interface
// ============================================================================

/**
 * The agent object returned by defineAnthropicAgent().
 */
export interface AnthropicAgent<TInput, TOutput> {
	/** Agent identifier (readonly) */
	readonly name: string;

	/**
	 * Run agent and return typed output.
	 *
	 * @param input - Input data matching inputSchema
	 * @param options - Optional execution options
	 * @returns Promise resolving to typed output
	 * @throws Error if validation fails or execution times out
	 */
	execute(input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput>;

	/**
	 * Run agent with streaming handle.
	 *
	 * @param input - Input data matching inputSchema
	 * @param options - Optional streaming options
	 * @returns Handle for interaction control
	 */
	stream(input: TInput, options?: StreamOptions<TOutput>): AgentHandle<TOutput>;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a typed Anthropic agent.
 *
 * @example
 * ```typescript
 * const MyAgent = defineAnthropicAgent({
 *   name: "MyCoder",
 *   prompt: myPromptTemplate,
 *   inputSchema: z.object({ task: z.string() }),
 *   outputSchema: z.object({ code: z.string() }),
 * });
 *
 * const result = await MyAgent.execute({ task: "Write hello world" });
 * console.log(result.code);
 * ```
 */
export declare function defineAnthropicAgent<TInput, TOutput>(
	definition: AnthropicAgentDefinition<TInput, TOutput>,
): AnthropicAgent<TInput, TOutput>;

// ============================================================================
// Prompt Template Factory
// ============================================================================

/**
 * Create a type-safe prompt template.
 *
 * @example
 * ```typescript
 * const template = createPromptTemplate(
 *   "You are a coding assistant. Task: {{task}}",
 *   z.object({ task: z.string() })
 * );
 *
 * const prompt = template.render({ task: "Write a function" });
 * ```
 */
export declare function createPromptTemplate<TData>(template: string, schema?: z.ZodType<TData>): PromptTemplate<TData>;

// ============================================================================
// Preset Type Aliases (for presets subpath)
// ============================================================================

/**
 * Coding agent input type.
 */
export interface CodingInput {
	task: string;
}

/**
 * Coding agent output type.
 */
export interface CodingOutput {
	code: string;
	explanation?: string;
	language?: string;
}

/**
 * Review agent input type.
 */
export interface ReviewInput {
	task: string;
	implementationSummary: string;
}

/**
 * Review agent output type.
 */
export interface ReviewOutput {
	approved: boolean;
	issues: Array<{
		severity: "error" | "warning" | "info";
		message: string;
		location?: string;
	}>;
	suggestions?: string[];
}

/**
 * Planner agent input type.
 */
export interface PlannerInput {
	prd: string;
}

/**
 * Planner agent output type.
 */
export interface PlannerOutput {
	tasks: Array<{
		id: string;
		title: string;
		description: string;
		dependencies: string[];
	}>;
}
