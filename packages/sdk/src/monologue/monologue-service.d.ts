/**
 * Monologue Service Implementation
 *
 * Core service that buffers agent events and generates narratives.
 * Each decorated method gets its own service instance via closure scope.
 *
 * @module monologue/monologue-service
 */
import type { AgentEvent, IMonologueLLM, IMonologueService, MonologueConfig, NarrativeAgentName, NarrativeEntry } from "./types.js";
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
export declare class MonologueService implements IMonologueService {
    private buffer;
    private history;
    private isFirstEvent;
    private config;
    private scope;
    private sessionId;
    private taskId;
    private callback?;
    private llm;
    constructor(options: MonologueServiceOptions);
    /**
     * Add an event to the buffer.
     * May trigger narrative generation if thresholds are met.
     */
    addEvent(event: AgentEvent): Promise<void>;
    /**
     * Check if buffer has enough events to ask the LLM.
     */
    shouldAskLLM(): boolean;
    /**
     * Check if buffer is full and must be flushed.
     */
    mustFlush(): boolean;
    /**
     * Ask the LLM to generate a narrative.
     */
    generateNarrative(force?: boolean): Promise<NarrativeEntry | null>;
    /**
     * Final flush - called when decorated method completes.
     */
    finalFlush(): Promise<NarrativeEntry | null>;
    /**
     * Get current narrative history.
     */
    getHistory(): string[];
    /**
     * Clear buffer and history.
     */
    reset(): void;
    /**
     * Get current configuration.
     */
    getConfig(): MonologueConfig;
    /**
     * Get current buffer size.
     */
    getBufferSize(): number;
    /**
     * Check if LLM response is a wait signal.
     */
    private isWaitSignal;
    /**
     * Create a NarrativeEntry from generated text.
     */
    private createNarrativeEntry;
}
/**
 * Factory function for creating MonologueService instances.
 * Used by the @Monologue decorator to create scoped instances.
 */
export declare function createMonologueService(options: MonologueServiceOptions): MonologueService;
