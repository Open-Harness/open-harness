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
