/**
 * Provider Types for @openharness/anthropic
 *
 * Type definitions for the defineAnthropicAgent factory and related interfaces.
 * These types implement the contract from specs/013-anthropic-refactor/contracts/factory-api.ts
 *
 * @module provider/types
 */

import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { IAgentCallbacks } from "@openharness/sdk";
import type { z } from "zod";

// ============================================================================
// Template Types
// ============================================================================

/**
 * Extract variable names from template string at compile time.
 *
 * Uses recursive template literal types to parse `{{variable}}` placeholders.
 *
 * @example
 * ```typescript
 * type Vars = ExtractVars<"Hello {{name}}, your task is {{task}}">;
 * // Vars = "name" | "task"
 * ```
 */
export type ExtractVars<S extends string> = S extends `${string}{{${infer Var}}}${infer Rest}`
	? Var | ExtractVars<Rest>
	: never;

/**
 * Type-safe prompt template with compile-time variable validation.
 *
 * Templates use `{{variable}}` syntax for interpolation. When created with
 * `createPromptTemplate()`, the TData type is inferred from the template string.
 */
export interface PromptTemplate<TData> {
	/** The raw template string with `{{variable}}` placeholders */
	readonly template: string;

	/**
	 * Render the template by interpolating data values.
	 *
	 * @param data - Object with values for each template variable
	 * @returns The rendered prompt string
	 */
	render(data: TData): string;

	/**
	 * Optional runtime validation of input data.
	 *
	 * When a Zod schema is provided to `createPromptTemplate()`, this function
	 * validates data at runtime in addition to compile-time type checking.
	 */
	validate?(data: unknown): data is TData;
}

// ============================================================================
// Agent Definition
// ============================================================================

/**
 * Configuration for defining an Anthropic agent via `defineAnthropicAgent()`.
 *
 * This is the main configuration object that determines agent behavior:
 * - Name for identification and logging
 * - Prompt template or static string for LLM input
 * - Input/output schemas for type safety
 * - Optional SDK passthrough options
 * - Optional recording and monologue features
 */
export interface AnthropicAgentDefinition<TInput, TOutput> {
	/** Unique agent identifier used in logs and events */
	name: string;

	/** Prompt template (with type-safe variables) or static string */
	prompt: PromptTemplate<TInput> | string;

	/** Zod schema for validating input before execution */
	inputSchema: z.ZodType<TInput>;

	/** Zod schema for validating and typing structured output */
	outputSchema: z.ZodType<TOutput>;

	/** Optional SDK options passthrough (model, maxTurns, etc.) */
	options?: Partial<Options>;

	/** Optional recording configuration for replay tests */
	recording?: {
		/** Enable recording (default: false) */
		enabled?: boolean;
		/** Path to vault directory for recordings */
		vaultPath?: string;
	};

	/** Optional monologue configuration for internal reasoning */
	monologue?: {
		/** Enable monologue feature (default: false) */
		enabled?: boolean;
		/** Scope identifier for monologue context */
		scope?: string;
	};
}

// ============================================================================
// Execution Options
// ============================================================================

/**
 * Options for `agent.execute()` method.
 *
 * All options are optional - sensible defaults are provided.
 */
export interface ExecuteOptions<TOutput> {
	/** Event callbacks for progress, tokens, errors, etc. */
	callbacks?: IAgentCallbacks<TOutput>;

	/** Session identifier (auto-generated UUID if omitted) */
	sessionId?: string;

	/**
	 * Override prompt template at runtime.
	 *
	 * Allows using a different prompt while keeping the same agent configuration.
	 * The override template's TData must be compatible with the agent's TInput.
	 */
	prompt?: PromptTemplate<unknown>;

	/** Execution timeout in milliseconds (no timeout if omitted) */
	timeoutMs?: number;
}

/**
 * Options for `agent.stream()` method.
 *
 * Extends ExecuteOptions with streaming-specific options.
 */
export interface StreamOptions<TOutput> extends ExecuteOptions<TOutput> {
	// Streaming-specific options can be added here in future
}

// ============================================================================
// Agent Handle (Streaming)
// ============================================================================

/**
 * Handle returned by `agent.stream()` for interaction control.
 *
 * Provides methods to control a running agent execution:
 * - Cancel execution
 * - Inject additional input
 * - Change model mid-execution
 * - Await final result
 */
export interface AgentHandle<TOutput> {
	/**
	 * Cancel agent execution immediately.
	 *
	 * The result promise will reject with an interruption error.
	 */
	interrupt(): void;

	/**
	 * Inject additional input mid-execution.
	 *
	 * Useful for multi-turn conversations or providing clarifications.
	 */
	streamInput(input: string): void;

	/**
	 * Change the model mid-execution.
	 *
	 * Takes effect on the next turn.
	 */
	setModel(model: string): void;

	/**
	 * Promise resolving to the final typed output.
	 *
	 * Rejects if execution is interrupted or fails.
	 */
	readonly result: Promise<TOutput>;
}

// ============================================================================
// Agent Interface
// ============================================================================

/**
 * The agent object returned by `defineAnthropicAgent()`.
 *
 * Provides two execution methods:
 * - `execute()`: Run and await result
 * - `stream()`: Run with interaction handle
 */
export interface AnthropicAgent<TInput, TOutput> {
	/** Agent identifier (matches definition.name) */
	readonly name: string;

	/**
	 * Run agent and return typed output.
	 *
	 * @param input - Input data matching inputSchema
	 * @param options - Optional execution options
	 * @returns Promise resolving to typed output
	 * @throws Error if input validation fails
	 * @throws Error if execution times out
	 * @throws Error if output validation fails
	 */
	execute(input: TInput, options?: ExecuteOptions<TOutput>): Promise<TOutput>;

	/**
	 * Run agent with streaming handle for interaction control.
	 *
	 * @param input - Input data matching inputSchema
	 * @param options - Optional streaming options
	 * @returns Handle for controlling execution
	 */
	stream(input: TInput, options?: StreamOptions<TOutput>): AgentHandle<TOutput>;
}

// ============================================================================
// Preset Type Aliases
// ============================================================================

/**
 * Coding agent input type.
 * Used by the CodingAgent preset.
 */
export interface CodingInput {
	/** The coding task to perform */
	task: string;
}

/**
 * Coding agent output type.
 * Structured output from CodingAgent.
 */
export interface CodingOutput {
	/** Generated code */
	code: string;
	/** Optional explanation of the code */
	explanation?: string;
	/** Programming language used */
	language?: string;
}

/**
 * Review agent input type.
 * Used by the ReviewAgent preset.
 */
export interface ReviewInput {
	/** Original task that was implemented */
	task: string;
	/** Summary of what was implemented */
	implementationSummary: string;
}

/**
 * Issue found during code review.
 */
export interface ReviewIssue {
	/** Issue severity level */
	severity: "error" | "warning" | "info";
	/** Description of the issue */
	message: string;
	/** Optional file/line location */
	location?: string;
}

/**
 * Review agent output type.
 * Structured output from ReviewAgent.
 */
export interface ReviewOutput {
	/** Whether the implementation is approved */
	approved: boolean;
	/** List of issues found */
	issues: ReviewIssue[];
	/** Optional improvement suggestions */
	suggestions?: string[];
}

/**
 * Planner agent input type.
 * Used by the PlannerAgent preset.
 */
export interface PlannerInput {
	/** Product Requirements Document to break into tasks */
	prd: string;
}

/**
 * Task generated by the planner.
 */
export interface PlannerTask {
	/** Unique task identifier */
	id: string;
	/** Task title */
	title: string;
	/** Detailed task description */
	description: string;
	/** IDs of tasks this depends on */
	dependencies: string[];
}

/**
 * Planner agent output type.
 * Structured output from PlannerAgent.
 */
export interface PlannerOutput {
	/** Ordered list of tasks */
	tasks: PlannerTask[];
}
