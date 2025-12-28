/**
 * Agent Factory - Provider-agnostic container management
 *
 * This module provides container management for agent creation.
 * For actual agent implementations, use a provider package:
 * - @openharness/anthropic: Anthropic/Claude agents
 */

import type { Container } from "@needle-di/core";
import type { IAgentCallbacks } from "../callbacks/types.js";
import { createContainer } from "../infra/container.js";

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
 * Options for agent creation
 */
export type AgentOptions = {
	/** Model override */
	model?: "haiku" | "sonnet" | "opus";
	/** Default callbacks */
	callbacks?: IAgentCallbacks;
};

// ============================================
// Internal Container (Singleton)
// ============================================

let _globalContainer: Container | null = null;

function getGlobalContainer(): Container {
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
export function setGlobalContainer(container: Container): void {
	_globalContainer = container;
}

/**
 * Get the global container. Creates one if not already set.
 *
 * @example
 * ```typescript
 * import { getContainer } from "@openharness/sdk";
 * import { registerAnthropicProvider, CodingAgent } from "@openharness/anthropic";
 *
 * const container = getContainer();
 * registerAnthropicProvider(container);
 *
 * const coder = container.get(CodingAgent);
 * ```
 */
export function getContainer(): Container {
	return getGlobalContainer();
}

// ============================================
// Agent Factory (Provider-Agnostic)
// ============================================

/**
 * @deprecated Agent creation is now provider-specific.
 *
 * Use provider packages instead:
 * - @openharness/anthropic: `container.get(CodingAgent)`
 *
 * This function now throws an error directing users to the proper approach.
 */
export function createAgent(_input: unknown, _options?: unknown): never {
	throw new Error(
		"createAgent() is deprecated. Use a provider package instead:\n" +
			"\n" +
			"  import { CodingAgent } from '@openharness/anthropic';\n" +
			"  const coder = container.get(CodingAgent);\n",
	);
}
