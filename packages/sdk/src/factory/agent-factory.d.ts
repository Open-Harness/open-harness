/**
 * Agent Factory - Provider-agnostic container management
 *
 * This module provides container management for agent creation.
 * For actual agent implementations, use a provider package:
 * - @openharness/anthropic: Anthropic/Claude agents
 */
import type { Container } from "@needle-di/core";
import type { IAgentCallbacks } from "../callbacks/types.js";
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
/**
 * Reset the global container. Useful for testing.
 */
export declare function resetGlobalContainer(): void;
/**
 * Set a custom container. Useful for testing or custom setups.
 */
export declare function setGlobalContainer(container: Container): void;
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
export declare function getContainer(): Container;
