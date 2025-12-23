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

export const IAgentRunnerToken = new InjectionToken<IAgentRunner>("IAgentRunner");

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
