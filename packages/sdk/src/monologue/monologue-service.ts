/**
 * Monologue Service Implementation
 *
 * Core service that buffers agent events and generates narratives.
 * Each decorated method gets its own service instance via closure scope.
 *
 * @module monologue/monologue-service
 */

import type {
	AgentEvent,
	IMonologueLLM,
	IMonologueService,
	MonologueConfig,
	NarrativeAgentName,
	NarrativeEntry,
} from "./types.js";
import { DEFAULT_MONOLOGUE_CONFIG } from "./types.js";

/**
 * Callback for receiving generated narratives.
 */
export interface MonologueCallback {
	onNarrative(entry: NarrativeEntry): void;
	onError?(error: Error, events: AgentEvent[]): void;
}

/**
 * Options for creating a MonologueService instance.
 */
export interface MonologueServiceOptions {
	llm: IMonologueLLM;
	config?: Partial<MonologueConfig>;
	scope: NarrativeAgentName;
	sessionId: string;
	taskId?: string;
	callback?: MonologueCallback;
}

/**
 * MonologueService - buffers events, manages history, coordinates with LLM.
 *
 * State flow:
 * 1. Events arrive via addEvent()
 * 2. If buffer.length >= minBufferSize, ask LLM
 * 3. LLM returns narrative or "..." (wait)
 * 4. On narrative: emit, clear buffer, add to history
 * 5. On wait: keep buffering
 * 6. On finalFlush: LLM must respond (method completing)
 *
 * Note: This service is not DI-injectable directly. Use createMonologueService()
 * or get the LLM from the container and pass it to the constructor.
 */
export class MonologueService implements IMonologueService {
	private buffer: AgentEvent[] = [];
	private history: string[] = [];
	private isFirstEvent = true;
	private config: MonologueConfig;
	private scope: NarrativeAgentName;
	private sessionId: string;
	private taskId: string | null;
	private callback?: MonologueCallback;
	private llm: IMonologueLLM;

	constructor(options: MonologueServiceOptions) {
		this.llm = options.llm;
		this.config = { ...DEFAULT_MONOLOGUE_CONFIG, ...options.config };
		this.scope = options.scope;
		this.sessionId = options.sessionId;
		this.taskId = options.taskId ?? null;
		this.callback = options.callback;
	}

	/**
	 * Add an event to the buffer.
	 * May trigger narrative generation if thresholds are met.
	 */
	async addEvent(event: AgentEvent): Promise<void> {
		this.buffer.push(event);

		// Check if we should generate a narrative
		if (this.mustFlush()) {
			// Forced flush - buffer at max
			await this.generateNarrative(true);
		} else if (this.shouldAskLLM()) {
			// Ask LLM - may wait or generate
			await this.generateNarrative(false);
		}
	}

	/**
	 * Check if buffer has enough events to ask the LLM.
	 */
	shouldAskLLM(): boolean {
		return this.buffer.length >= this.config.minBufferSize;
	}

	/**
	 * Check if buffer is full and must be flushed.
	 */
	mustFlush(): boolean {
		return this.buffer.length >= this.config.maxBufferSize;
	}

	/**
	 * Ask the LLM to generate a narrative.
	 */
	async generateNarrative(force = false): Promise<NarrativeEntry | null> {
		if (this.buffer.length === 0) {
			return null;
		}

		const startTime = Date.now();

		try {
			const text = await this.llm.generate(this.buffer, this.history, this.config, this.isFirstEvent, force);

			// Check for wait signal
			if (this.isWaitSignal(text)) {
				// LLM wants more context - keep buffering
				return null;
			}

			// Empty string indicates error - don't emit
			if (text === "") {
				return null;
			}

			// Create narrative entry
			const entry = this.createNarrativeEntry(text, startTime, force);

			// Update state
			this.history.push(text);
			if (this.history.length > this.config.historySize) {
				this.history.shift(); // FIFO sliding window
			}
			this.buffer = [];
			this.isFirstEvent = false;

			// Emit via callback
			this.callback?.onNarrative(entry);

			return entry;
		} catch (error) {
			// Narrative generation should never block agent execution
			this.callback?.onError?.(error as Error, [...this.buffer]);
			return null;
		}
	}

	/**
	 * Final flush - called when decorated method completes.
	 */
	async finalFlush(): Promise<NarrativeEntry | null> {
		if (this.buffer.length === 0) {
			return null;
		}

		return this.generateNarrative(true);
	}

	/**
	 * Get current narrative history.
	 */
	getHistory(): string[] {
		return [...this.history];
	}

	/**
	 * Clear buffer and history.
	 */
	reset(): void {
		this.buffer = [];
		this.history = [];
		this.isFirstEvent = true;
	}

	/**
	 * Get current configuration.
	 */
	getConfig(): MonologueConfig {
		return { ...this.config };
	}

	/**
	 * Get current buffer size.
	 */
	getBufferSize(): number {
		return this.buffer.length;
	}

	/**
	 * Check if LLM response is a wait signal.
	 */
	private isWaitSignal(text: string): boolean {
		const trimmed = text.trim();
		return trimmed === "..." || trimmed === "";
	}

	/**
	 * Create a NarrativeEntry from generated text.
	 */
	private createNarrativeEntry(text: string, startTime: number, isFinal: boolean): NarrativeEntry {
		return {
			timestamp: Date.now(),
			agentName: this.scope,
			taskId: this.taskId,
			text,
			metadata: {
				eventCount: this.buffer.length,
				historyLength: this.history.length,
				isFinal,
				model: this.config.model,
				latencyMs: Date.now() - startTime,
			},
		};
	}
}

/**
 * Factory function for creating MonologueService instances.
 * Used by the @Monologue decorator to create scoped instances.
 */
export function createMonologueService(options: MonologueServiceOptions): MonologueService {
	return new MonologueService(options);
}
