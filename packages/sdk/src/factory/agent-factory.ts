/**
 * Agent Factory - Creates agents without exposing DI container
 *
 * Supports three modes:
 * 1. Built-in agents: createAgent('coder', options)
 * 2. Config-based agents: createAgent({ name, prompt, ... })
 * 3. Class-based agents: createAgent(MyAgentClass, options)
 *
 * All agents use the unified IAgentCallbacks interface.
 */

import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { BaseAnthropicAgent } from "../providers/anthropic/agents/base-anthropic-agent.js";
import { CodingAgent } from "../providers/anthropic/agents/coding-agent.js";
import { PlannerAgent } from "../providers/anthropic/agents/planner-agent.js";
import { ReviewAgent } from "../providers/anthropic/agents/review-agent.js";
import type { IAgentCallbacks } from "../callbacks/types.js";
import { createContainer } from "../core/container.js";
import { type IAgentRunner, IAnthropicRunnerToken, type IEventBus, IEventBusToken } from "../core/tokens.js";

// ============================================
// Types
// ============================================

/**
 * Configuration for creating a simple config-based agent
 */
export type AgentConfig = {
	/** Agent name */
	name: string;
	/** Prompt template (supports {{variable}} interpolation) */
	prompt: string;
	/** Optional: default model */
	model?: "haiku" | "sonnet" | "opus";
	/** Optional: output schema for structured responses */
	outputSchema?: unknown;
	/** Optional: initial state */
	state?: Record<string, unknown>;
	/** Optional: default callbacks */
	callbacks?: IAgentCallbacks;
};

/**
 * Built-in agent types
 */
export type BuiltInAgentType = "coder" | "reviewer" | "planner";

/**
 * Options for agent creation
 */
export type AgentOptions = {
	/** Model override */
	model?: "haiku" | "sonnet" | "opus";
	/** Default callbacks */
	callbacks?: IAgentCallbacks;
};

/**
 * Agent class constructor type
 */
export type AgentClass<TArgs extends unknown[] = unknown[]> = new (...args: TArgs) => BaseAnthropicAgent;

// ============================================
// Internal Container (Singleton)
// ============================================

let _globalContainer: ReturnType<typeof createContainer> | null = null;

function getGlobalContainer() {
	if (!_globalContainer) {
		_globalContainer = createContainer({ mode: "live" });
	}
	return _globalContainer;
}

/**
 * Reset the global container. Useful for testing.
 */
export function resetGlobalContainer(): void {
	_globalContainer = null;
}

/**
 * Set a custom container. Useful for testing or custom setups.
 */
export function setGlobalContainer(container: ReturnType<typeof createContainer>): void {
	_globalContainer = container;
}

// ============================================
// Config-based Agent
// ============================================

class ConfigAgent extends BaseAnthropicAgent {
	private config: AgentConfig;
	private agentOptions?: AgentOptions;

	constructor(
		config: AgentConfig,
		options: AgentOptions | undefined,
		runner: IAgentRunner,
		eventBus: IEventBus | null,
	) {
		super(config.name, runner, eventBus);
		this.config = config;
		this.agentOptions = options;
	}

	/**
	 * Run the agent with prompt template interpolation
	 */
	async execute<TOutput = unknown>(
		promptOrVars: string | Record<string, unknown>,
		sessionId: string,
		options?: { callbacks?: IAgentCallbacks<TOutput> },
	): Promise<TOutput> {
		let finalPrompt: string;

		// If string, use as-is
		if (typeof promptOrVars === "string") {
			finalPrompt = promptOrVars;
		} else {
			// Interpolate template variables
			finalPrompt = this.interpolate(this.config.prompt, {
				...this.config.state,
				...promptOrVars,
			});
		}

		// Merge callbacks
		const mergedCallbacks = {
			...this.config.callbacks,
			...this.agentOptions?.callbacks,
			...options?.callbacks,
		} as IAgentCallbacks<TOutput>;

		return this.run<TOutput>(finalPrompt, sessionId, {
			model: this.agentOptions?.model || this.config.model || "haiku",
			outputFormat: this.config.outputSchema as Options["outputFormat"],
			callbacks: mergedCallbacks,
		});
	}

	private interpolate(template: string, vars: Record<string, unknown>): string {
		return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
			return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`;
		});
	}
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create an agent from a built-in type
 */
function createBuiltInAgent(type: BuiltInAgentType, _options?: AgentOptions): BaseAnthropicAgent {
	const container = getGlobalContainer();

	switch (type) {
		case "coder":
			return container.get(CodingAgent);
		case "reviewer":
			return container.get(ReviewAgent);
		case "planner":
			return container.get(PlannerAgent);
		default:
			throw new Error(`Unknown built-in agent type: ${type}`);
	}
}

/**
 * Create an agent from a config object
 */
function createConfigAgent(config: AgentConfig, options?: AgentOptions): BaseAnthropicAgent {
	const container = getGlobalContainer();
	const runner = container.get(IAnthropicRunnerToken);
	const eventBus = container.get(IEventBusToken);
	return new ConfigAgent(config, options, runner, eventBus);
}

/**
 * Create an agent from a class constructor
 */
function createClassAgent(agentConstructor: AgentClass, _options?: AgentOptions): BaseAnthropicAgent {
	const container = getGlobalContainer();

	// Check if class is registered in container
	try {
		return container.get(agentConstructor);
	} catch {
		// If not registered, instantiate manually
		const runner = container.get(IAnthropicRunnerToken);
		const eventBus = container.get(IEventBusToken);
		return new agentConstructor(runner, eventBus);
	}
}

// ============================================
// Main Factory (Overloaded)
// ============================================

/**
 * Create an agent - supports multiple modes
 *
 * @example
 * // Built-in agent
 * const coder = createAgent('coder');
 * await coder.execute("Write a hello world", "session-1", {
 *   callbacks: { onText: (text) => console.log(text) }
 * });
 *
 * @example
 * // Config-based agent
 * const myAgent = createAgent({
 *   name: 'MyAgent',
 *   prompt: 'You are a {{role}} expert. Task: {{task}}',
 *   state: { role: 'TypeScript' }
 * });
 *
 * @example
 * // Class-based agent
 * class CustomAgent extends BaseAnthropicAgent { ... }
 * const custom = createAgent(CustomAgent);
 */
export function createAgent(type: BuiltInAgentType, options?: AgentOptions): BaseAnthropicAgent;
export function createAgent(config: AgentConfig, options?: AgentOptions): BaseAnthropicAgent;
export function createAgent(AgentClass: AgentClass, options?: AgentOptions): BaseAnthropicAgent;
export function createAgent(
	input: BuiltInAgentType | AgentConfig | AgentClass,
	options?: AgentOptions,
): BaseAnthropicAgent {
	// Built-in agent type
	if (typeof input === "string") {
		return createBuiltInAgent(input as BuiltInAgentType, options);
	}

	// Class constructor
	if (typeof input === "function") {
		return createClassAgent(input as AgentClass, options);
	}

	// Config object
	if (typeof input === "object" && "name" in input && "prompt" in input) {
		return createConfigAgent(input as AgentConfig, options);
	}

	throw new Error("Invalid agent input. Must be a built-in type, config object, or class constructor.");
}
