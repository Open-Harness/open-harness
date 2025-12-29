/**
 * IAgentCallbacks - Unified callback interface across all providers
 *
 * Re-exports from @openharness/core for convenience.
 * SDK consumers can import from either @openharness/sdk or @openharness/core.
 *
 * SDK-specific types (StreamCallbacks) are defined locally.
 */

import type { AgentEvent } from "../infra/tokens.js";

// ============================================================================
// Re-exports from @openharness/core
// ============================================================================

// TODO: @openharness/core package doesn't exist in monorepo
// These types should be defined locally or in a shared package
// export type {
// 	AgentError,
// 	AgentResult,
// 	AgentStartMetadata,
// 	IAgentCallbacks,
// 	NarrativeConfig,
// 	ProgressEvent,
// 	TokenUsage,
// 	ToolCallEvent,
// 	ToolResultEvent,
// } from "@openharness/core";

// Placeholder stub types until proper package structure is defined
export interface IAgentCallbacks<TOutput = unknown> {
	onStart?: (metadata: AgentStartMetadata) => void | Promise<void>;
	onText?: (text: string, final: boolean) => void | Promise<void>;
	onThinking?: (thinking: string) => void | Promise<void>;
	onNarrative?: (text: string, config?: NarrativeConfig) => void | Promise<void>;
	onProgress?: (event: ProgressEvent) => void | Promise<void>;
	onToolCall?: (event: ToolCallEvent) => void | Promise<void>;
	onToolResult?: (event: ToolResultEvent) => void | Promise<void>;
	onComplete?: (result: AgentResult<TOutput>) => void | Promise<void>;
	onResult?: (result: AgentResult<TOutput>) => void | Promise<void>;
	onError?: (error: AgentError) => void | Promise<void>;
}

export interface AgentStartMetadata {
	agentId?: string; // Optional for backward compatibility
	agentName?: string; // Alternative identifier
	sessionId?: string;
	timestamp?: Date;
	[key: string]: unknown;
}

export interface NarrativeConfig {
	importance?: "low" | "medium" | "high";
	[key: string]: unknown;
}

export interface ProgressEvent {
	percent?: number;
	message?: string;
	toolName?: string;
	elapsedSeconds?: number;
	[key: string]: unknown;
}

export interface ToolCallEvent {
	toolName: string;
	arguments?: Record<string, unknown>;
	input?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface ToolResultEvent {
	toolName?: string;
	result?: unknown;
	content?: string;
	isError?: boolean;
	[key: string]: unknown;
}

export interface AgentResult<TOutput = unknown> {
	output?: TOutput;
	success?: boolean;
	usage?: TokenUsage;
	durationMs?: number;
	errors?: string[];
	[key: string]: unknown;
}

export interface AgentError {
	message: string;
	code?: string;
	cause?: unknown;
	[key: string]: unknown;
}

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	cacheReadInputTokens?: number;
	cacheCreationInputTokens?: number;
	[key: string]: unknown;
}

// ============================================================================
// Legacy Compatibility (SDK-specific)
// ============================================================================

/**
 * Session result for legacy callbacks.
 */
export interface SessionResult {
	stopReason?: string;
	summary?: string;
	[key: string]: unknown;
}
