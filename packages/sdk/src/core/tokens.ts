/**
 * Injection Tokens for NeedleDI
 *
 * This file defines all interfaces and their corresponding InjectionTokens.
 * Services depend on tokens (abstractions), not concrete classes.
 *
 * PATTERN: Promise + Callbacks (no async generators)
 */

import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { InjectionToken } from "@needle-di/core";

// ============================================================================
// Callbacks - The core event mechanism
// ============================================================================

/**
 * Callbacks fired during agent execution.
 * All callbacks are optional - provide only what you need.
 */
export type RunnerCallbacks = {
	onMessage?: (message: SDKMessage) => void;
};

// ============================================================================
// Configuration
// ============================================================================

export interface IConfig {
	isReplayMode: boolean;
	recordingsDir: string;
}

export const IConfigToken = new InjectionToken<IConfig>("IConfig");

// ============================================================================
// Agent Runner - Core abstraction for LLM execution
// ============================================================================

export interface IAgentRunner {
	/**
	 * Run a prompt and return the final result.
	 * Fires callbacks for each message during execution.
	 */
	run(args: { prompt: string; options: Options; callbacks?: RunnerCallbacks }): Promise<SDKMessage | undefined>;
}

/**
 * @deprecated Use provider-specific tokens instead (IAnthropicRunnerToken, etc.)
 */
export const IAgentRunnerToken = new InjectionToken<IAgentRunner>("IAgentRunner");

// ============================================================================
// Provider-Specific Runner Tokens
// ============================================================================

/**
 * Token for Anthropic/Claude runner.
 */
export const IAnthropicRunnerToken = new InjectionToken<IAgentRunner>("IAnthropicRunner");

/**
 * Token for OpenCode runner (future).
 */
export const IOpenCodeRunnerToken = new InjectionToken<IAgentRunner>("IOpenCodeRunner");

/**
 * Token for Replay runner (testing).
 */
export const IReplayRunnerToken = new InjectionToken<IAgentRunner>("IReplayRunner");

// ============================================================================
// Vault (Recording Storage)
// ============================================================================

export interface IVaultSession {
	exists(): boolean;
	getMessages(): SDKMessage[];
	save(messages: SDKMessage[]): Promise<void>;
}

export interface IVault {
	startSession(category: string, id: string): Promise<IVaultSession>;
}

export const IVaultToken = new InjectionToken<IVault>("IVault");

// ============================================================================
// Recording (Decorator Support)
// ============================================================================

export interface IRecorder {
	/**
	 * Wrap a runner call with recording capability.
	 * Captures all messages and saves them after completion.
	 */
	run(args: {
		prompt: string;
		options: Options;
		callbacks?: RunnerCallbacks;
		runFn: (args: { prompt: string; options: Options; callbacks?: RunnerCallbacks }) => Promise<SDKMessage | undefined>;
	}): Promise<SDKMessage | undefined>;
}

export interface IRecordingFactory {
	createRecorder(category: string, id: string): IRecorder;
}

export const IRecordingFactoryToken = new InjectionToken<IRecordingFactory>("IRecordingFactory");

// ============================================================================
// Event Bus (Cross-cutting Communication)
// ============================================================================

import type { AgentEvent } from "../runner/models.js";

export interface IEventBus {
	publish(event: AgentEvent): void | Promise<void>;
	subscribe(listener: (event: AgentEvent) => void | Promise<void>): () => void;
}

export const IEventBusToken = new InjectionToken<IEventBus>("IEventBus");

// ============================================================================
// Container Interface (for decorators)
// ============================================================================

/**
 * Interface for DI container used by decorators.
 * Allows retrieving services by their injection token.
 */
export interface IContainer {
	get<T>(token: InjectionToken<T>): T;
}

// ============================================================================
// Recorded Session (for Vault storage)
// ============================================================================

export type RecordedSession = {
	prompt: string;
	options: Options;
	messages: SDKMessage[];
};

// ============================================================================
// Monologue System
// ============================================================================

import type { IAgentCallbacks } from "../callbacks/types.js";

/**
 * Configuration for monologue generation.
 */
export interface IMonologueConfig {
	/** Whether monologue is enabled */
	enabled: boolean;
	/** Model to use for narrative generation (default: 'haiku') */
	model?: "haiku" | "sonnet" | "opus";
	/** Custom system prompt override */
	systemPrompt?: string;
	/** Minimum events to buffer before considering emit */
	minBufferSize?: number;
	/** Force emit when buffer reaches this size */
	maxBufferSize?: number;
	/** Minimum time between emits (ms) */
	throttleMs?: number;
}

/**
 * Monologue decorator interface for wrapping agents with narrative generation.
 */
export interface IMonologueDecorator {
	/**
	 * Wrap callbacks with monologue generation.
	 * @param callbacks Original callbacks
	 * @param config Monologue configuration
	 * @returns Enhanced callbacks with monologue support
	 */
	wrapCallbacks<TOutput>(
		callbacks: IAgentCallbacks<TOutput> | undefined,
		config: IMonologueConfig,
	): IAgentCallbacks<TOutput>;
}

export const IMonologueDecoratorToken = new InjectionToken<IMonologueDecorator>("IMonologueDecorator");

/**
 * Runner for generating monologue narratives using a cheap model.
 */
export interface IMonologueRunner {
	/**
	 * Generate narrative text from buffered events.
	 * @param events Buffered agent events
	 * @param history Previous narrative history
	 * @returns Generated narrative text
	 */
	generateNarrative(events: AgentEvent[], history: string[]): Promise<string>;
}

export const IMonologueRunnerToken = new InjectionToken<IMonologueRunner>("IMonologueRunner");

// ============================================================================
// Recording Decorator
// ============================================================================

/**
 * Recording decorator interface for wrapping agent execution.
 */
export interface IRecordingDecorator {
	/**
	 * Wrap agent execution with recording/replay capability.
	 * @param sessionId Session identifier
	 * @param category Recording category (e.g., 'golden', 'scratch')
	 */
	wrap(
		sessionId: string,
		category?: string,
	): {
		beforeRun: (prompt: string, options: Options) => void;
		afterRun: (result: SDKMessage | undefined) => Promise<void>;
	};
}

export const IRecordingDecoratorToken = new InjectionToken<IRecordingDecorator>("IRecordingDecorator");

// ============================================================================
// Prompt Registry
// ============================================================================

/**
 * Prompt registry interface for loading and formatting prompts.
 */
export interface IPromptRegistry {
	/**
	 * Format a prompt template with given parameters.
	 * @param templateName Name of the template (e.g., 'coding', 'review')
	 * @param params Template parameters
	 * @returns Formatted prompt string
	 */
	format(templateName: string, params: Record<string, unknown>): Promise<string>;
}

export const IPromptRegistryToken = new InjectionToken<IPromptRegistry>("IPromptRegistry");
