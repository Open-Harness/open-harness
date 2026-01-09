/**
 * Unified adapter interface for agent SDKs.
 *
 * This interface allows different SDKs (Claude, OpenCode, etc.) to be used
 * interchangeably through a common abstraction layer.
 */

/**
 * Options for querying an agent SDK.
 */
export interface AgentQueryOptions {
	/** Messages to send to the agent */
	messages: UnifiedMessage[];
	/** Optional session ID for resuming conversations */
	sessionId?: string;
	/** Simple model identifier (e.g., "claude-3-5-sonnet") */
	model?: string;
	/** Provider-specific model selection */
	providerID?: string;
	/** Provider-specific model identifier */
	modelID?: string;
	/** JSON schema for structured output */
	outputSchema?: Record<string, unknown>;
	/** Abort controller for cancellation */
	abortController?: AbortController;
}

/**
 * Unified message format for agent input.
 */
export interface UnifiedMessage {
	/** Message role */
	role: "user" | "assistant";
	/** Message content */
	content: string;
	/** Optional tool use ID for tool result messages */
	toolUseId?: string;
	/** Optional tool use result */
	toolUseResult?: unknown;
	/** Whether this is a synthetic message */
	isSynthetic?: boolean;
}

/**
 * Usage metrics from agent execution.
 */
export interface UsageMetrics {
	/** Input tokens used */
	inputTokens: number;
	/** Output tokens used */
	outputTokens: number;
	/** Cache creation input tokens (if applicable) */
	cacheCreationInputTokens?: number;
	/** Cache read input tokens (if applicable) */
	cacheReadInputTokens?: number;
	/** Model-specific usage breakdown */
	modelUsage?: Record<string, { inputTokens: number; outputTokens: number }>;
	/** Total cost in USD (if applicable) */
	totalCostUsd?: number;
}

/**
 * Session state information.
 */
export interface SessionState {
	/** Session identifier */
	sessionId: string;
	/** Number of turns in the conversation */
	numTurns?: number;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Unified agent message types emitted by adapters.
 */
export type UnifiedAgentMessage =
	| {
			type: "start";
			sessionId: string;
			model?: string;
	  }
	| {
			type: "text_delta";
			sessionId?: string;
			content: string;
	  }
	| {
			type: "text";
			sessionId?: string;
			content: string;
	  }
	| {
			type: "thinking_delta";
			sessionId?: string;
			content: string;
	  }
	| {
			type: "thinking";
			sessionId?: string;
			content: string;
	  }
	| {
			type: "tool_call";
			sessionId?: string;
			toolId: string;
			toolName: string;
			toolInput: unknown;
	  }
	| {
			type: "tool_result";
			sessionId?: string;
			toolId: string;
			toolName: string;
			toolOutput: unknown;
			error?: string;
	  }
	| {
			type: "complete";
			sessionId?: string;
			content?: string;
			structuredOutput?: unknown;
			usage?: UsageMetrics;
			durationMs?: number;
			numTurns?: number;
	  }
	| {
			type: "error";
			sessionId?: string;
			error: Error;
			errorType?: string;
			message?: string;
			details?: unknown;
	  };

/**
 * Adapter interface for agent SDKs.
 *
 * Implementations of this interface provide a unified way to interact with
 * different agent SDKs (Claude, OpenCode, etc.) while isolating SDK-specific
 * differences.
 */
export interface AgentSDKAdapter {
	/**
	 * Execute a query and stream unified messages.
	 *
	 * @param options - Query options including messages, session, model, etc.
	 * @returns Async generator of unified agent messages
	 */
	query(options: AgentQueryOptions): AsyncGenerator<UnifiedAgentMessage>;

	/**
	 * Abort a running query.
	 *
	 * @param sessionId - Session ID to abort
	 */
	abort(sessionId: string): Promise<void>;

	/**
	 * Get session state (if available).
	 *
	 * @param sessionId - Session ID to query
	 * @returns Session state or undefined if not available
	 */
	getSession(sessionId: string): Promise<SessionState | undefined>;
}
