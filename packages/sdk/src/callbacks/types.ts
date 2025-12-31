/**
 * IAgentCallbacks - Unified callback interface across all providers
 *
 * Re-exports from @openharness/core for convenience.
 * SDK consumers can import from either @openharness/sdk or @openharness/core.
 *
 * SDK-specific types (StreamCallbacks) are defined locally.
 */

import type { AgentEvent } from "../core/tokens.js";

// ============================================================================
// Re-exports from @openharness/core
// ============================================================================

export type {
	AgentError,
	AgentResult,
	AgentStartMetadata,
	IAgentCallbacks,
	NarrativeConfig,
	ProgressEvent,
	TokenUsage,
	ToolCallEvent,
	ToolResultEvent,
} from "@openharness/core";

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

/**
 * @deprecated Use IAgentCallbacks instead. This alias exists for migration.
 */
export type StreamCallbacks = {
	onSessionStart?: (metadata: Record<string, unknown>, event: AgentEvent) => void;
	onText?: (content: string, event: AgentEvent) => void;
	onThinking?: (thought: string, event: AgentEvent) => void;
	onToolCall?: (toolName: string, input: Record<string, unknown>, event: AgentEvent) => void;
	onToolResult?: (result: Record<string, unknown>, event: AgentEvent) => void;
	onToolProgress?: (toolName: string, elapsedSeconds: number, event: AgentEvent) => void;
	onCompact?: (data: { trigger: "manual" | "auto"; pre_tokens: number }, event: AgentEvent) => void;
	onStatus?: (data: { status: "compacting" | null }, event: AgentEvent) => void;
	onResult?: (result: SessionResult, event: AgentEvent) => void;
	onSessionEnd?: (content: string, isError: boolean, event: AgentEvent) => void;
	onError?: (error: string, event: AgentEvent) => void;
};
