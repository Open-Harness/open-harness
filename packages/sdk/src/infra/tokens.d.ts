/**
 * Injection Tokens for NeedleDI
 *
 * This file defines all interfaces and their corresponding InjectionTokens.
 * Services depend on tokens (abstractions), not concrete classes.
 *
 * PATTERN: Promise + Callbacks (no async generators)
 *
 * NOTE: This is a PROVIDER-AGNOSTIC module. Anthropic-specific types
 * should be imported from @openharness/anthropic.
 */
import { InjectionToken } from "@needle-di/core";
/**
 * Generic agent event for the event bus.
 * Provider packages can extend this or use their own event types.
 */
export interface AgentEvent {
    /** ISO timestamp of the event */
    timestamp: Date;
    /** Type of event (e.g., 'tool_call', 'text', 'thinking', 'result') */
    event_type: string;
    /** Name of the agent that emitted this event */
    agent_name: string;
    /** Optional text content */
    content?: string | null;
    /** Session identifier */
    session_id?: string;
    /** Tool name for tool events */
    tool_name?: string;
    /** Tool input for tool_call events */
    tool_input?: unknown;
    /** Tool result for tool_result events */
    tool_result?: unknown;
    /** Whether this is an error event */
    is_error?: boolean;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Generic message type for runner callbacks.
 * Provider packages define their own specific message types.
 */
export interface GenericMessage {
    type: string;
    content?: unknown;
    [key: string]: unknown;
}
/**
 * Callbacks fired during agent execution.
 * All callbacks are optional - provide only what you need.
 */
export type RunnerCallbacks = {
    onMessage?: (message: GenericMessage) => void;
};
export interface IConfig {
    isReplayMode: boolean;
    recordingsDir: string;
}
export declare const IConfigToken: InjectionToken<IConfig>;
/**
 * Generic options for agent runners.
 * Provider packages define their own specific options.
 */
export interface GenericRunnerOptions {
    model?: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    [key: string]: unknown;
}
export interface IAgentRunner {
    /**
     * Run a prompt and return the final result.
     * Fires callbacks for each message during execution.
     */
    run(args: {
        prompt: string;
        options: GenericRunnerOptions;
        callbacks?: RunnerCallbacks;
    }): Promise<GenericMessage | undefined>;
}
/**
 * Generic token for IAgentRunner.
 * Provider packages bind their specific runner to this token.
 */
export declare const IAgentRunnerToken: InjectionToken<IAgentRunner>;
/**
 * Token for Anthropic/Claude runner.
 */
export declare const IAnthropicRunnerToken: InjectionToken<IAgentRunner>;
/**
 * Token for OpenCode runner (future).
 */
export declare const IOpenCodeRunnerToken: InjectionToken<IAgentRunner>;
/**
 * Token for Replay runner (testing).
 */
export declare const IReplayRunnerToken: InjectionToken<IAgentRunner>;
export interface IVaultSession {
    exists(): boolean;
    getMessages(): GenericMessage[];
    save(messages: GenericMessage[]): Promise<void>;
}
export interface IVault {
    startSession(category: string, id: string): Promise<IVaultSession>;
}
export declare const IVaultToken: InjectionToken<IVault>;
export interface IRecorder {
    /**
     * Wrap a runner call with recording capability.
     * Captures all messages and saves them after completion.
     */
    run(args: {
        prompt: string;
        options: GenericRunnerOptions;
        callbacks?: RunnerCallbacks;
        runFn: (args: {
            prompt: string;
            options: GenericRunnerOptions;
            callbacks?: RunnerCallbacks;
        }) => Promise<GenericMessage | undefined>;
    }): Promise<GenericMessage | undefined>;
}
export interface IRecordingFactory {
    createRecorder(category: string, id: string): IRecorder;
}
export declare const IRecordingFactoryToken: InjectionToken<IRecordingFactory>;
import type { IUnifiedEventBus } from "./unified-events/types.js";
/**
 * Token for UnifiedEventBus - combines AgentEvent and HarnessEvent streams
 * with automatic AsyncLocalStorage context propagation.
 */
export declare const IUnifiedEventBusToken: InjectionToken<IUnifiedEventBus>;
/**
 * Interface for DI container used by decorators.
 * Allows retrieving services by their injection token.
 */
export interface IContainer {
    get<T>(token: InjectionToken<T>): T;
}
export type RecordedSession = {
    prompt: string;
    options: GenericRunnerOptions;
    messages: GenericMessage[];
};
export { IMonologueConfigToken, IMonologueLLMToken, IMonologueServiceToken, } from "../monologue/tokens.js";
export type { IMonologueLLM, IMonologueService, MonologueConfig, } from "../monologue/types.js";
import type { IAgentCallbacks } from "../callbacks/types.js";
/**
 * Configuration for monologue generation.
 */
export interface IMonologueConfig {
    /** Whether monologue is enabled */
    enabled: boolean;
    /** Model to use for narrative generation (default: 'haiku') */
    model?: "haiku" | "sonnet" | "opus";
    /** Custom system prompt override */
    systemPrompt?: string;
    /** Minimum events to buffer before considering emit */
    minBufferSize?: number;
    /** Force emit when buffer reaches this size */
    maxBufferSize?: number;
    /** Minimum time between emits (ms) */
    throttleMs?: number;
}
/**
 * Monologue decorator interface for wrapping agents with narrative generation.
 */
export interface IMonologueDecorator {
    /**
     * Wrap callbacks with monologue generation.
     * @param callbacks Original callbacks
     * @param config Monologue configuration
     * @returns Enhanced callbacks with monologue support
     */
    wrapCallbacks<TOutput>(callbacks: IAgentCallbacks<TOutput> | undefined, config: IMonologueConfig): IAgentCallbacks<TOutput>;
}
export declare const IMonologueDecoratorToken: InjectionToken<IMonologueDecorator>;
/**
 * Runner for generating monologue narratives using a cheap model.
 */
export interface IMonologueRunner {
    /**
     * Generate narrative text from buffered events.
     * @param events Buffered agent events
     * @param history Previous narrative history
     * @returns Generated narrative text
     */
    generateNarrative(events: AgentEvent[], history: string[]): Promise<string>;
}
export declare const IMonologueRunnerToken: InjectionToken<IMonologueRunner>;
/**
 * Recording decorator interface for wrapping agent execution.
 */
export interface IRecordingDecorator {
    /**
     * Wrap agent execution with recording/replay capability.
     * @param sessionId Session identifier
     * @param category Recording category (e.g., 'golden', 'scratch')
     */
    wrap(sessionId: string, category?: string): {
        beforeRun: (prompt: string, options: GenericRunnerOptions) => void;
        afterRun: (result: GenericMessage | undefined) => Promise<void>;
    };
}
export declare const IRecordingDecoratorToken: InjectionToken<IRecordingDecorator>;
/**
 * Prompt registry interface for loading and formatting prompts.
 */
export interface IPromptRegistry {
    /**
     * Format a prompt template with given parameters.
     * @param templateName Name of the template (e.g., 'coding', 'review')
     * @param params Template parameters
     * @returns Formatted prompt string
     */
    format(templateName: string, params: Record<string, unknown>): Promise<string>;
}
export declare const IPromptRegistryToken: InjectionToken<IPromptRegistry>;
/**
 * Token for ParserAgent - parses tasks.md into structured ParsedTask[]
 */
export declare const IParserAgentToken: InjectionToken<IParserAgent>;
/**
 * Token for TaskHarness - orchestrates task execution with Parser, Coding, Review agents
 */
export declare const ITaskHarnessToken: InjectionToken<ITaskHarness>;
/**
 * Parser Agent interface for converting tasks.md to structured output
 */
export interface IParserAgent {
    /**
     * Parse a tasks.md file into structured tasks
     * @param input Parser input containing file path and content
     * @returns Parsed tasks with phases, warnings, and metadata
     */
    parse(input: IParserAgentInput): Promise<IParserAgentOutput>;
}
/**
 * Input to Parser Agent
 */
export interface IParserAgentInput {
    tasksFilePath: string;
    tasksContent: string;
    specFilePath?: string;
}
/**
 * Output from Parser Agent
 */
export interface IParserAgentOutput {
    tasks: IParsedTask[];
    phases: IPhaseInfo[];
    warnings: string[];
    metadata: IParserMetadata;
}
/**
 * Parsed task from tasks.md
 */
export interface IParsedTask {
    id: string;
    phase: string;
    phaseNumber: number;
    description: string;
    filePaths: string[];
    userStory: string | null;
    dependencies: string[];
    status: "complete" | "pending";
    validationCriteria: string;
    flags: ITaskFlags;
}
/**
 * Task flags parsed from task line
 */
export interface ITaskFlags {
    parallel: boolean;
    constitution: string | null;
}
/**
 * Phase information extracted from tasks.md
 */
export interface IPhaseInfo {
    number: number;
    name: string;
    purpose: string;
    independentTest: string | null;
    goal: string | null;
}
/**
 * Parser metadata
 */
export interface IParserMetadata {
    totalTasks: number;
    completeTasks: number;
    pendingTasks: number;
    cycles: string[][];
    sourcePath: string;
}
/**
 * Task Harness interface for orchestrating task execution
 */
export interface ITaskHarness {
    /**
     * Run the harness to execute tasks
     * @param callbacks Optional callbacks for progress updates
     * @returns Summary of execution
     */
    run(callbacks?: ITaskHarnessCallbacks): Promise<IHarnessSummary>;
    /**
     * Get current harness state
     */
    getState(): ITaskHarnessState;
    /**
     * Get session ID for this run
     */
    getSessionId(): string;
    /**
     * Abort execution
     */
    abort(): void;
}
/**
 * Task Harness configuration
 */
export interface ITaskHarnessConfig {
    tasksFilePath: string;
    mode: "live" | "replay";
    continueOnFailure?: boolean;
    taskTimeoutMs?: number;
    sessionId?: string;
    resumeFromCheckpoint?: string;
}
/**
 * Task Harness callbacks
 */
export interface ITaskHarnessCallbacks {
    onTasksParsed?: (result: IParserAgentOutput) => void;
    onTaskStart?: (task: IParsedTask) => void;
    onTaskComplete?: (task: IParsedTask, result: ITaskResult) => void;
    onTaskValidated?: (task: IParsedTask, result: IValidationResult) => void;
    onTaskFailed?: (task: IParsedTask, failure: IFailureRecord) => void;
    onNarrative?: (entry: INarrativeEntry) => void;
    onComplete?: (summary: IHarnessSummary) => void;
}
/**
 * Task execution result
 */
export interface ITaskResult {
    taskId: string;
    success: boolean;
    summary: string;
    filesModified: string[];
    output: unknown;
    durationMs: number;
}
/**
 * Validation result from Review Agent
 */
export interface IValidationResult {
    taskId: string;
    passed: boolean;
    reasoning: string;
    suggestedFixes: string[];
    confidence: number;
    uncertainties: string[];
}
/**
 * Failure record
 */
export interface IFailureRecord {
    taskId: string;
    stage: "coding" | "validation";
    error: string;
    retryable: boolean;
    timestamp: number;
}
/**
 * Narrative entry for unified stream
 */
export interface INarrativeEntry {
    timestamp: number;
    agentName: "Parser" | "Coder" | "Reviewer" | "Harness";
    taskId: string | null;
    text: string;
}
/**
 * Harness execution summary
 */
export interface IHarnessSummary {
    totalTasks: number;
    completedTasks: number;
    validatedTasks: number;
    failedTasks: number;
    skippedTasks: number;
    durationMs: number;
}
/**
 * Task Harness state
 */
export interface ITaskHarnessState {
    tasks: IParsedTask[];
    taskQueue: string[];
    currentTaskId: string | null;
    completedTasks: Record<string, ITaskResult>;
    validatedTasks: Record<string, IValidationResult>;
    failedTasks: Record<string, IFailureRecord>;
    retryHistory: Record<string, IRetryRecord[]>;
    mode: "live" | "replay";
    continueOnFailure: boolean;
    sessionId: string;
}
/**
 * Retry record
 */
export interface IRetryRecord {
    attempt: number;
    previousFailure: IFailureRecord;
    feedback: string;
    timestamp: number;
}
