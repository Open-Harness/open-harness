/**
 * Monologue Wrapper - Transforms tool noise into readable narrative
 *
 * Wraps any agent to intercept events, buffer them, and synthesize
 * a first-person monologue using AI. Users see clean narrative instead
 * of raw tool calls.
 */

import type { BaseAnthropicAgent } from "../agents/base-anthropic-agent.js";
import { AgentMonologue } from "../agents/monologue.js";
import type { IAgentCallbacks } from "../callbacks/types.js";
import { createContainer } from "../core/container.js";
import { type AgentEvent, EventTypeConst } from "../runner/models.js";

// ============================================
// Types
// ============================================

export type MonologueConfig = {
	/** Number of events to buffer before generating monologue (default: 5) */
	bufferSize?: number;
	/** Model to use for monologue generation (default: 'haiku') */
	model?: "haiku" | "sonnet" | "opus";
	/** Callback for monologue narrative */
	onNarrative?: (text: string, metadata?: Record<string, unknown>) => void;
	/** Event types to buffer (default: TOOL_CALL, TOOL_RESULT, THINKING, TEXT) */
	eventTypes?: string[];
};

const DEFAULT_CONFIG: Required<MonologueConfig> = {
	bufferSize: 5,
	model: "haiku",
	onNarrative: () => {},
	eventTypes: [EventTypeConst.TOOL_CALL, EventTypeConst.TOOL_RESULT, EventTypeConst.THINKING, EventTypeConst.TEXT],
};

// ============================================
// Wrapped Agent
// ============================================

class MonologueWrappedAgent {
	private monologue: AgentMonologue;
	private config: Required<MonologueConfig>;
	private eventBuffer: AgentEvent[] = [];

	constructor(
		private baseAgent: BaseAnthropicAgent,
		config: MonologueConfig = {},
	) {
		this.config = { ...DEFAULT_CONFIG, ...config };

		// Get monologue instance from container
		const container = createContainer({ mode: "live" });
		this.monologue = container.get(AgentMonologue);
	}

	/**
	 * Create wrapped callbacks that intercept events for monologue generation
	 */
	wrapCallbacks<TOutput>(callbacks?: IAgentCallbacks<TOutput>): IAgentCallbacks<TOutput> {
		const sessionId = `monologue_${Date.now()}`;

		return {
			...callbacks,

			onText: (text, delta) => {
				if (this.config.eventTypes.includes(EventTypeConst.TEXT)) {
					this.eventBuffer.push({
						timestamp: new Date(),
						event_type: EventTypeConst.TEXT,
						agent_name: this.baseAgent.name,
						content: text,
						session_id: sessionId,
					});
					this.checkBufferAndGenerate(sessionId);
				}
				callbacks?.onText?.(text, delta);
			},

			onThinking: (thought) => {
				if (this.config.eventTypes.includes(EventTypeConst.THINKING)) {
					this.eventBuffer.push({
						timestamp: new Date(),
						event_type: EventTypeConst.THINKING,
						agent_name: this.baseAgent.name,
						content: thought,
						session_id: sessionId,
					});
					this.checkBufferAndGenerate(sessionId);
				}
				callbacks?.onThinking?.(thought);
			},

			onToolCall: (event) => {
				if (this.config.eventTypes.includes(EventTypeConst.TOOL_CALL)) {
					this.eventBuffer.push({
						timestamp: new Date(),
						event_type: EventTypeConst.TOOL_CALL,
						agent_name: this.baseAgent.name,
						tool_name: event.toolName,
						tool_input: event.input,
						content: `Calling tool: ${event.toolName}`,
						session_id: sessionId,
					});
					this.checkBufferAndGenerate(sessionId);
				}
				callbacks?.onToolCall?.(event);
			},

			onToolResult: (event) => {
				if (this.config.eventTypes.includes(EventTypeConst.TOOL_RESULT)) {
					this.eventBuffer.push({
						timestamp: new Date(),
						event_type: EventTypeConst.TOOL_RESULT,
						agent_name: this.baseAgent.name,
						tool_result: event.content as Record<string, unknown>,
						is_error: event.isError,
						session_id: sessionId,
					});
					this.checkBufferAndGenerate(sessionId);
				}
				callbacks?.onToolResult?.(event);
			},

			onComplete: async (result) => {
				// Generate final monologue if buffer has events
				if (this.eventBuffer.length > 0) {
					await this.generateMonologue(sessionId);
				}
				callbacks?.onComplete?.(result);
			},

			onError: callbacks?.onError,
			onStart: callbacks?.onStart,
			onProgress: callbacks?.onProgress,
			onNarrative: callbacks?.onNarrative,
		};
	}

	/**
	 * Check if buffer is full and generate monologue
	 */
	private checkBufferAndGenerate(sessionId: string) {
		if (this.eventBuffer.length >= this.config.bufferSize) {
			// Don't await - fire and forget to avoid blocking
			this.generateMonologue(sessionId).catch(console.error);
		}
	}

	/**
	 * Generate monologue from buffered events
	 */
	private async generateMonologue(sessionId: string) {
		if (this.eventBuffer.length === 0) return;

		// Pass events to monologue generator
		for (const event of this.eventBuffer) {
			this.monologue.ingest(event);
		}

		// Clear buffer
		this.eventBuffer = [];

		// Generate narrative
		const narrativeEvent = await this.monologue.generate(`${sessionId}_monologue`);

		if (narrativeEvent?.content) {
			this.config.onNarrative(narrativeEvent.content, narrativeEvent.metadata);
		}
	}

	/**
	 * Get the underlying base agent
	 */
	getBaseAgent(): BaseAnthropicAgent {
		return this.baseAgent;
	}

	/**
	 * Get agent name
	 */
	get name(): string {
		return this.baseAgent.name;
	}
}

// ============================================
// Factory Function
// ============================================

/**
 * Wrap an agent with monologue capability
 *
 * Creates a wrapper that intercepts agent events and generates human-readable
 * narratives. Use the returned wrapper's `wrapCallbacks` method to create
 * callbacks that will trigger monologue generation.
 *
 * @example
 * ```typescript
 * import { createAgent, withMonologue } from '@openharness/sdk';
 *
 * const coder = createAgent('coder');
 * const monologue = withMonologue(coder, {
 *   bufferSize: 5,
 *   onNarrative: (text) => {
 *     console.log(`Agent: ${text}`);
 *   }
 * });
 *
 * // Use wrapped callbacks when executing the agent
 * await coder.execute('Build a login page', 'session_1', {
 *   callbacks: monologue.wrapCallbacks({
 *     onText: (text) => process.stdout.write(text),
 *   }),
 * });
 * // Output: "Agent: I'm analyzing the requirements for a login page..."
 * // Output: "Agent: I've created the form structure and added validation..."
 * ```
 */
export function withMonologue(agent: BaseAnthropicAgent, config?: MonologueConfig): MonologueWrappedAgent {
	return new MonologueWrappedAgent(agent, config);
}
