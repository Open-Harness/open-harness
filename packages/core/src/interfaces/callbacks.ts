/**
 * Callback Interfaces - Unified event handling for agent execution
 *
 * These interfaces define the standard callbacks that all agent implementations
 * must support, regardless of the underlying LLM provider.
 *
 * @module @openharness/core/interfaces/callbacks
 */

/**
 * Metadata provided when an agent starts execution.
 */
export interface AgentStartMetadata {
	/** Agent name */
	agentName: string;
	/** Session identifier */
	sessionId: string;
	/** Model being used (e.g., 'haiku', 'sonnet', 'opus') */
	model?: string;
	/** Available tools */
	tools?: string[];
	/** Additional provider-specific metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Result from agent execution.
 */
export interface AgentResult<TOutput = unknown> {
	/** Whether execution succeeded */
	success: boolean;
	/** Structured output (validated if schema provided) */
	output?: TOutput;
	/** Token usage statistics */
	usage?: TokenUsage;
	/** Execution duration in milliseconds */
	durationMs?: number;
	/** Error messages if failed */
	errors?: string[];
}

/**
 * Token usage statistics.
 */
export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	cacheReadInputTokens?: number;
	cacheCreationInputTokens?: number;
}

/**
 * Event fired when an agent calls a tool.
 */
export interface ToolCallEvent {
	/** Name of the tool being called */
	toolName: string;
	/** Input parameters for the tool */
	input: Record<string, unknown>;
	/** Unique identifier for this tool call */
	toolUseId?: string;
}

/**
 * Event fired when a tool returns a result.
 */
export interface ToolResultEvent {
	/** Tool result content */
	content: unknown;
	/** Whether the tool execution errored */
	isError?: boolean;
	/** Unique identifier matching the tool call */
	toolUseId?: string;
}

/**
 * Progress event for long-running tools.
 */
export interface ProgressEvent {
	/** Name of the tool */
	toolName: string;
	/** Elapsed time in seconds */
	elapsedSeconds: number;
	/** Optional progress percentage (0-100) */
	progress?: number;
	/** Optional status message */
	message?: string;
}

/**
 * Error from agent execution.
 */
export interface AgentError {
	/** Error message */
	message: string;
	/** Error code if available */
	code?: string;
	/** Original error if wrapped */
	cause?: unknown;
}

/**
 * Configuration for narrative generation.
 */
export interface NarrativeConfig {
	/** Number of events to buffer before generating narrative (default: 5) */
	bufferSize?: number;
	/** Event types to include in narrative (default: all) */
	eventTypes?: string[];
	/** Model to use for narrative generation (default: 'haiku') */
	model?: "haiku" | "sonnet" | "opus";
}

/**
 * IAgentCallbacks - The unified callback interface for all providers.
 *
 * This interface provides a consistent way to handle agent events regardless
 * of the underlying LLM provider. Provider-specific base agents map their
 * native events to these callbacks.
 *
 * @template TOutput - The expected output type from the agent
 */
export interface IAgentCallbacks<TOutput = unknown> {
	// =========================================================================
	// Universal Events (all providers)
	// =========================================================================

	/**
	 * Fired when agent execution starts.
	 * @param metadata - Information about the agent and session
	 */
	onStart?: (metadata: AgentStartMetadata) => void;

	/**
	 * Fired when the agent produces text output.
	 * @param text - The text content
	 * @param delta - True if this is a delta/streaming update
	 */
	onText?: (text: string, delta: boolean) => void;

	/**
	 * Fired when agent execution completes successfully.
	 * @param result - The execution result including output
	 */
	onComplete?: (result: AgentResult<TOutput>) => void;

	/**
	 * Fired when an error occurs during execution.
	 * @param error - The error details
	 */
	onError?: (error: AgentError) => void;

	// =========================================================================
	// Tool Events (most providers)
	// =========================================================================

	/**
	 * Fired when the agent invokes a tool.
	 * @param event - Tool call details
	 */
	onToolCall?: (event: ToolCallEvent) => void;

	/**
	 * Fired when a tool returns its result.
	 * @param event - Tool result details
	 */
	onToolResult?: (event: ToolResultEvent) => void;

	// =========================================================================
	// Extended Events (provider-specific)
	// =========================================================================

	/**
	 * Fired when the agent is thinking/reasoning.
	 * NOTE: Only fires for providers that expose thinking (e.g., Anthropic)
	 * @param thought - The thinking content
	 */
	onThinking?: (thought: string) => void;

	/**
	 * Fired for progress updates on long-running operations.
	 * @param event - Progress details
	 */
	onProgress?: (event: ProgressEvent) => void;

	/**
	 * Fired when the agent generates a narrative summary of its actions.
	 * @param text - The narrative text in first person
	 * @param metadata - Optional metadata about the narrative generation
	 */
	onNarrative?: (text: string, metadata?: Record<string, unknown>) => void;

	/**
	 * Configuration for narrative generation.
	 */
	narrativeConfig?: NarrativeConfig;
}
