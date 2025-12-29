/**
 * Monologue System Type Definitions
 *
 * Core types for the monologue system.
 * NOTE: These are ONLY for agent narratives, not harness progress events.
 *
 * @module monologue/types
 */
import { z } from "zod";
/**
 * Configuration for monologue generation behavior.
 *
 * The LLM decides when to narrate based on its system prompt.
 * These thresholds are guardrails, not triggers.
 */
export interface MonologueConfig {
    /**
     * Minimum events to buffer before asking the LLM.
     * Below this threshold, we wait (don't bother the LLM).
     * @default 1
     */
    minBufferSize: number;
    /**
     * Maximum events to buffer before forcing the LLM to respond.
     * Memory protection - prevents unbounded growth.
     * @default 10
     */
    maxBufferSize: number;
    /**
     * Number of previous narratives to include as context.
     * Enables continuity: "Now that I've found X, I'm doing Y"
     * @default 5
     */
    historySize: number;
    /**
     * Model to use for narrative generation.
     * @default "haiku"
     */
    model: "haiku" | "sonnet" | "opus";
    /**
     * Custom system prompt. If omitted, uses DEFAULT_MONOLOGUE_PROMPT.
     *
     * The prompt should instruct the LLM:
     * - When to narrate vs wait (return "...")
     * - Tone and perspective (first-person, concise)
     * - How to use history for continuity
     */
    systemPrompt?: string;
}
/**
 * Default configuration values.
 */
export declare const DEFAULT_MONOLOGUE_CONFIG: MonologueConfig;
/**
 * Event types from agent execution.
 */
export type AgentEventType = "tool_call" | "tool_result" | "text" | "thinking" | "completion";
/**
 * An event from agent execution, buffered for narrative synthesis.
 */
export interface AgentEvent {
    event_type: AgentEventType;
    agent_name: string;
    session_id: string;
    timestamp: number;
    payload: AgentEventPayload;
}
/**
 * Discriminated union of event payloads.
 */
export type AgentEventPayload = ToolCallPayload | ToolResultPayload | TextPayload | ThinkingPayload | CompletionPayload;
export interface ToolCallPayload {
    type: "tool_call";
    tool_name: string;
    tool_input: unknown;
}
export interface ToolResultPayload {
    type: "tool_result";
    tool_name: string;
    result: unknown;
    error?: string;
}
export interface TextPayload {
    type: "text";
    content: string;
}
export interface ThinkingPayload {
    type: "thinking";
    content: string;
}
export interface CompletionPayload {
    type: "completion";
    summary?: string;
}
/**
 * Valid agent names for narrative attribution.
 *
 * NOTE: "Harness" is NOT included. Harness emits progress events,
 * not narratives. Narratives are LLM-generated from agent work.
 */
export type NarrativeAgentName = "Parser" | "Coder" | "Reviewer" | "Validator";
/**
 * Output from narrative generation.
 *
 * This represents what the LLM "said" about the agent's work.
 * First-person, natural language.
 */
export interface NarrativeEntry {
    timestamp: number;
    agentName: NarrativeAgentName;
    taskId: string | null;
    text: string;
    metadata?: NarrativeMetadata;
}
/**
 * Metadata about narrative generation.
 */
export interface NarrativeMetadata {
    /** Number of events that were summarized */
    eventCount: number;
    /** Current length of narrative history */
    historyLength: number;
    /** True if this is the final flush at method completion */
    isFinal: boolean;
    /** Model used for generation */
    model: string;
    /** Generation latency in milliseconds */
    latencyMs: number;
}
/**
 * Options for the @Monologue decorator.
 */
export interface MonologueDecoratorOptions {
    /**
     * Scope name for this decorated method.
     * Used for EventBus filtering and narrative attribution.
     */
    scope: NarrativeAgentName;
    /**
     * Override default configuration for this scope.
     */
    config?: Partial<MonologueConfig>;
}
/**
 * Interface for the LLM client. Allows mock injection for testing.
 */
export interface IMonologueLLM {
    /**
     * Generate narrative text from buffered events.
     *
     * @param events - Buffered agent events to summarize
     * @param history - Previous narratives for context continuity
     * @param config - Generation configuration
     * @param isFirst - True if this is the first event (always narrate)
     * @param isFinal - True if method is completing (must narrate)
     * @returns Generated narrative text, or "..." to continue buffering
     *
     * @example
     * // LLM returns narrative
     * "I read the config file and found the database settings."
     *
     * // LLM signals "wait for more context"
     * "..."
     */
    generate(events: AgentEvent[], history: string[], config: MonologueConfig, isFirst: boolean, isFinal: boolean): Promise<string>;
}
/**
 * Core service interface for monologue generation.
 */
export interface IMonologueService {
    /**
     * Add an event to the buffer.
     * May trigger flush if threshold reached.
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
     * @param force - If true, LLM must respond (final flush)
     */
    generateNarrative(force?: boolean): Promise<NarrativeEntry | null>;
    /**
     * Final flush - called when decorated method completes.
     */
    finalFlush(): Promise<NarrativeEntry | null>;
    /**
     * Get current narrative history for context.
     */
    getHistory(): string[];
    /**
     * Clear buffer and history. Used for cleanup/testing.
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
}
export declare const MonologueConfigSchema: z.ZodObject<{
    minBufferSize: z.ZodDefault<z.ZodNumber>;
    maxBufferSize: z.ZodDefault<z.ZodNumber>;
    historySize: z.ZodDefault<z.ZodNumber>;
    model: z.ZodDefault<z.ZodEnum<{
        haiku: "haiku";
        sonnet: "sonnet";
        opus: "opus";
    }>>;
    systemPrompt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AgentEventSchema: z.ZodObject<{
    event_type: z.ZodEnum<{
        tool_call: "tool_call";
        tool_result: "tool_result";
        text: "text";
        thinking: "thinking";
        completion: "completion";
    }>;
    agent_name: z.ZodString;
    session_id: z.ZodString;
    timestamp: z.ZodNumber;
    payload: z.ZodUnknown;
}, z.core.$strip>;
export declare const NarrativeMetadataSchema: z.ZodObject<{
    eventCount: z.ZodNumber;
    historyLength: z.ZodNumber;
    isFinal: z.ZodBoolean;
    model: z.ZodString;
    latencyMs: z.ZodNumber;
}, z.core.$strip>;
export declare const NarrativeEntrySchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    agentName: z.ZodEnum<{
        Parser: "Parser";
        Coder: "Coder";
        Reviewer: "Reviewer";
        Validator: "Validator";
    }>;
    taskId: z.ZodNullable<z.ZodString>;
    text: z.ZodString;
    metadata: z.ZodOptional<z.ZodObject<{
        eventCount: z.ZodNumber;
        historyLength: z.ZodNumber;
        isFinal: z.ZodBoolean;
        model: z.ZodString;
        latencyMs: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
