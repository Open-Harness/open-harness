/**
 * Monologue Wrapper - Transforms tool noise into readable narrative
 *
 * Wraps any agent to intercept events, buffer them, and synthesize
 * a first-person monologue using AI. Users see clean narrative instead
 * of raw tool calls.
 */

import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { AgentMonologue } from "../agents/monologue.js";
import { createContainer } from "../core/container.js";
import type { BaseAgent, StreamCallbacks } from "../runner/base-agent.js";
import { EventTypeConst } from "../runner/models.js";

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

import type { AgentEvent } from "../runner/models.js";

class MonologueWrappedAgent {
	private monologue: AgentMonologue;
	private config: Required<MonologueConfig>;
	private eventBuffer: AgentEvent[] = [];

	constructor(
		private baseAgent: BaseAgent,
		config: MonologueConfig = {},
	) {
		this.config = { ...DEFAULT_CONFIG, ...config };

		// Get monologue instance from container
		const container = createContainer({ mode: "live" });
		this.monologue = container.get(AgentMonologue);
	}

	/**
	 * Run the agent with monologue enabled
	 */
	async run(prompt: string, sessionId: string, options?: Options & { callbacks?: StreamCallbacks }) {
		const { callbacks, ...runOptions } = options || {};

		// Create wrapped callbacks that intercept events
		const wrappedCallbacks: StreamCallbacks = {
			...callbacks,

			// Intercept events and buffer them
			onText: (content, event) => {
				if (this.config.eventTypes.includes(EventTypeConst.TEXT)) {
					this.eventBuffer.push(event);
					this.checkBufferAndGenerate(sessionId);
				}
				callbacks?.onText?.(content, event);
			},

			onThinking: (thought, event) => {
				if (this.config.eventTypes.includes(EventTypeConst.THINKING)) {
					this.eventBuffer.push(event);
					this.checkBufferAndGenerate(sessionId);
				}
				callbacks?.onThinking?.(thought, event);
			},

			onToolCall: (toolName, input, event) => {
				if (this.config.eventTypes.includes(EventTypeConst.TOOL_CALL)) {
					this.eventBuffer.push(event);
					this.checkBufferAndGenerate(sessionId);
				}
				callbacks?.onToolCall?.(toolName, input, event);
			},

			onToolResult: (result, event) => {
				if (this.config.eventTypes.includes(EventTypeConst.TOOL_RESULT)) {
					this.eventBuffer.push(event);
					this.checkBufferAndGenerate(sessionId);
				}
				callbacks?.onToolResult?.(result, event);
			},

			// Pass through other callbacks
			onSessionStart: callbacks?.onSessionStart,
			onToolProgress: callbacks?.onToolProgress,
			onCompact: callbacks?.onCompact,
			onStatus: callbacks?.onStatus,
			onResult: async (result, event) => {
				// Generate final monologue if buffer has events
				if (this.eventBuffer.length > 0) {
					await this.generateMonologue(sessionId);
				}
				callbacks?.onResult?.(result, event);
			},
			onSessionEnd: callbacks?.onSessionEnd,
			onError: callbacks?.onError,
		};

		// Run base agent with wrapped callbacks
		return this.baseAgent.run(prompt, sessionId, {
			...runOptions,
			callbacks: wrappedCallbacks,
		});
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
	getBaseAgent(): BaseAgent {
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
 * Transforms raw tool calls and events into a readable first-person narrative.
 * Perfect for long-running agents where you want high-level progress updates.
 *
 * @example
 * ```typescript
 * import { createAgent, withMonologue } from 'bun-vi';
 *
 * const coder = createAgent('coder');
 * const narrativeCoder = withMonologue(coder, {
 *   bufferSize: 5,
 *   onNarrative: (text) => {
 *     console.log(`Agent: ${text}`);
 *   }
 * });
 *
 * await narrativeCoder.run('Build a login page', 'session_1');
 * // Output: "Agent: I'm analyzing the requirements for a login page..."
 * // Output: "Agent: I've created the form structure and added validation..."
 * ```
 */
export function withMonologue(agent: BaseAgent, config?: MonologueConfig): MonologueWrappedAgent {
	return new MonologueWrappedAgent(agent, config);
}
