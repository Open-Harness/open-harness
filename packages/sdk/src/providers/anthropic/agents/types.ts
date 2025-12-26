/**
 * Agent Types - Core interfaces for the provider-agnostic agent system
 *
 * This file defines the IAgent interface and related types that enable:
 * - Typed inputs and outputs for safe agent chaining
 * - Provider-agnostic execution (works with any LLM)
 * - Unified callbacks across all providers
 */

import type { ZodSchema } from "zod";
import type { AgentResult, IAgentCallbacks } from "../../../callbacks/index.js";

// ============================================================================
// IAgent Interface - The Core Abstraction
// ============================================================================

/**
 * IAgent<TInput, TOutput> - Provider-agnostic agent interface
 *
 * This is the core abstraction that all agents must implement. It enables:
 * - Type-safe chaining: output of one agent feeds input of another
 * - Provider independence: same interface works with Anthropic, OpenAI, etc.
 * - Unified callbacks: consistent event handling across providers
 *
 * @template TInput - The typed input for this agent
 * @template TOutput - The typed output from this agent
 *
 * @example
 * ```typescript
 * // Type-safe chaining
 * const analysis: AnalysisOutput = await analyzer.execute({ ticket }, sessionId);
 * const code: CodingOutput = await coder.execute({ task: analysis.plan }, sessionId);
 * const review: ReviewOutput = await reviewer.execute({ implementation: code.summary }, sessionId);
 *
 * // Loop based on typed output
 * while (review.decision === 'reject') {
 *   code = await coder.execute({ task: analysis.plan, feedback: review.feedback }, sessionId);
 *   review = await reviewer.execute({ implementation: code.summary }, sessionId);
 * }
 * ```
 */
export interface IAgent<TInput, TOutput> {
	/**
	 * Unique name identifying this agent.
	 */
	readonly name: string;

	/**
	 * Execute the agent with typed input.
	 *
	 * @param input - Typed input for the agent
	 * @param sessionId - Unique session identifier for tracking
	 * @param callbacks - Optional callbacks for event handling
	 * @returns Promise resolving to typed output
	 */
	execute(input: TInput, sessionId: string, callbacks?: IAgentCallbacks<TOutput>): Promise<TOutput>;
}

// ============================================================================
// Runner Options
// ============================================================================

/**
 * Options for configuring agent execution.
 */
export interface RunnerOptions {
	/** Model to use (provider-specific interpretation) */
	model?: "haiku" | "sonnet" | "opus" | string;
	/** Zod schema for structured output validation */
	outputSchema?: ZodSchema;
	/** List of allowed tools (empty = no tools) */
	allowedTools?: string[];
	/** Maximum output tokens */
	maxTokens?: number;
	/** Temperature for sampling */
	temperature?: number;
	/** Additional provider-specific options */
	[key: string]: unknown;
}

// ============================================================================
// Agent Runner Interface (New Provider-Agnostic Version)
// ============================================================================

/**
 * Event emitted by runners during execution.
 */
export interface AgentEvent {
	timestamp: Date;
	eventType: string;
	agentName: string;
	content?: string;
	toolName?: string;
	toolInput?: Record<string, unknown>;
	toolResult?: Record<string, unknown>;
	isError?: boolean;
	metadata?: Record<string, unknown>;
	sessionId?: string;
}

/**
 * Callbacks for runner execution.
 */
export interface RunnerCallbacks {
	onEvent?: (event: AgentEvent) => void;
}

/**
 * Arguments for running an agent.
 */
export interface RunArgs {
	/** The prompt to send to the LLM */
	prompt: string;
	/** Configuration options */
	options: RunnerOptions;
	/** Event callbacks */
	callbacks?: RunnerCallbacks;
}

/**
 * IAgentRunner - Provider-agnostic runner interface
 *
 * This interface abstracts the actual LLM execution. Each provider
 * implements this interface, mapping their SDK to the common format.
 */
export interface IAgentRunner {
	/**
	 * Run a prompt and return the result.
	 *
	 * @param args - Run arguments including prompt, options, and callbacks
	 * @returns Promise resolving to AgentResult
	 */
	run(args: RunArgs): Promise<AgentResult>;
}

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Configuration for creating an agent.
 */
export interface AgentDefinition<TInput, TOutput> {
	/** Agent name */
	name: string;
	/** Prompt template (supports {{variable}} interpolation) */
	prompt: string;
	/** Default model to use */
	model?: "haiku" | "sonnet" | "opus";
	/** Zod schema for output validation */
	outputSchema?: ZodSchema<TOutput>;
	/** Allowed tools */
	allowedTools?: string[];
	/** Function to build prompt from typed input */
	buildPrompt?: (input: TInput) => string;
	/** Function to extract typed output from result */
	extractOutput?: (result: AgentResult) => TOutput;
}
