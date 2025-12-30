/**
 * Agent Interfaces - Provider-agnostic agent abstractions
 *
 * These are the core contracts that all agents and runners must implement,
 * regardless of the underlying LLM provider.
 *
 * @module @openharness/core/interfaces/agent
 */

import type { AgentResult, IAgentCallbacks } from "./callbacks.js";

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

/**
 * Options for configuring agent execution.
 */
export interface RunnerOptions {
	/** Model to use (provider-specific interpretation) */
	model?: "haiku" | "sonnet" | "opus" | string;
	/** Maximum output tokens */
	maxTokens?: number;
	/** Temperature for sampling */
	temperature?: number;
	/** List of allowed tools (empty = no tools) */
	allowedTools?: string[];
	/** Additional provider-specific options */
	[key: string]: unknown;
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
 * Callbacks for runner execution.
 */
export interface RunnerCallbacks {
	onEvent?: (event: AgentEvent) => void;
}

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
