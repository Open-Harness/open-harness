/**
 * Agent Factory - Creates agents without exposing DI container
 *
 * Supports three modes:
 * 1. Built-in agents: createAgent('coder', options)
 * 2. Config-based agents: createAgent({ name, prompt, ... })
 * 3. Class-based agents: createAgent(MyAgentClass, options)
 */

import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { CodingAgent } from "../agents/coding-agent.js";
import { ReviewAgent } from "../agents/review-agent.js";
import { createContainer } from "../core/container.js";
import { IAgentRunnerToken } from "../core/tokens.js";
import { BaseAgent, type StreamCallbacks } from "../runner/base-agent.js";

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
	callbacks?: StreamCallbacks;
};

/**
 * Built-in agent types
 */
export type BuiltInAgentType = "coder" | "reviewer";

/**
 * Options for agent creation
 */
export type AgentOptions = {
	/** Model override */
	model?: "haiku" | "sonnet" | "opus";
	/** Default callbacks */
	callbacks?: StreamCallbacks;
};

/**
 * Agent class constructor type
 */
export type AgentClass<TArgs extends unknown[] = any[]> = new (...args: TArgs) => BaseAgent;

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

// ============================================
// Config-based Agent
// ============================================

class ConfigAgent extends BaseAgent {
	constructor(
		private config: AgentConfig,
		private options?: AgentOptions,
	) {
		const container = getGlobalContainer();
		const runner = container.get(IAgentRunnerToken);
		super(config.name, runner, null);
	}

	/**
	 * Run the agent with prompt template interpolation
	 */
	override async run(
		promptOrVars: string | Record<string, unknown>,
		sessionId: string,
		runOptions?: Options & { callbacks?: StreamCallbacks },
	) {
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

		// Merge callbacks and options
		const mergedCallbacks = {
			...this.config.callbacks,
			...this.options?.callbacks,
			...runOptions?.callbacks,
		};

		const mergedOptions: Options = {
			model: this.options?.model || this.config.model || "haiku",
			...runOptions,
			outputFormat: (this.config.outputSchema as Options["outputFormat"]) || runOptions?.outputFormat,
		};

		return super.run(finalPrompt, sessionId, {
			...mergedOptions,
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
function createBuiltInAgent(type: BuiltInAgentType, _options?: AgentOptions): BaseAgent {
	const container = getGlobalContainer();

	switch (type) {
		case "coder":
			return container.get(CodingAgent);
		case "reviewer":
			return container.get(ReviewAgent);
		default:
			throw new Error(`Unknown built-in agent type: ${type}`);
	}
}

/**
 * Create an agent from a config object
 */
function createConfigAgent(config: AgentConfig, options?: AgentOptions): BaseAgent {
	return new ConfigAgent(config, options);
}

/**
 * Create an agent from a class constructor
 */
function createClassAgent(agentConstructor: AgentClass, _options?: AgentOptions): BaseAgent {
	const container = getGlobalContainer();

	// Check if class is registered in container
	try {
		return container.get(agentConstructor);
	} catch {
		// If not registered, instantiate manually
		const runner = container.get(IAgentRunnerToken);
		return new agentConstructor(runner);
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
 * const coder = createAgent('coder', { model: 'haiku' });
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
 * class CustomAgent extends BaseAgent { ... }
 * const custom = createAgent(CustomAgent);
 */
export function createAgent(type: BuiltInAgentType, options?: AgentOptions): BaseAgent;
export function createAgent(config: AgentConfig, options?: AgentOptions): BaseAgent;
export function createAgent(AgentClass: AgentClass, options?: AgentOptions): BaseAgent;
export function createAgent(input: BuiltInAgentType | AgentConfig | AgentClass, options?: AgentOptions): BaseAgent {
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
