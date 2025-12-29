/**
 * InternalAnthropicAgent - Core agent implementation for the factory pattern
 *
 * This class is NOT exported from the package. It is used internally by
 * `defineAnthropicAgent()` to provide the actual agent execution logic.
 *
 * Key differences from BaseAnthropicAgent:
 * - Uses ONLY IUnifiedEventBus (no legacy IEventBus)
 * - Not intended for subclassing - factory pattern instead
 * - Simpler event handling (unified bus only)
 *
 * @internal
 * @module provider/internal-agent
 */
import type { GenericRunnerOptions, IAgentCallbacks, IAgentRunner, IUnifiedEventBus } from "@openharness/sdk";
/**
 * Options for internal agent execution.
 * Uses SDK's GenericRunnerOptions with additional callback support.
 */
export interface InternalRunOptions<TOutput = unknown> extends GenericRunnerOptions {
    /** Callbacks for agent events */
    callbacks?: IAgentCallbacks<TOutput>;
    /** Timeout in milliseconds */
    timeoutMs?: number;
    /** Output format for structured responses */
    outputFormat?: unknown;
}
/**
 * Internal agent implementation used by the factory.
 *
 * This class:
 * - Wraps the IAgentRunner for LLM execution
 * - Emits events to IUnifiedEventBus (unified bus only, no legacy bus)
 * - Fires typed callbacks during execution
 * - Handles timeouts and result processing
 *
 * @internal Not exported from package
 */
export declare class InternalAnthropicAgent {
    readonly name: string;
    private readonly runner;
    private readonly unifiedBus;
    constructor(name: string, runner?: IAgentRunner, unifiedBus?: IUnifiedEventBus | null);
    /**
     * Run the agent with a prompt.
     *
     * @param prompt - The prompt to send to the LLM
     * @param sessionId - Unique session identifier
     * @param options - Execution options including callbacks
     * @returns The structured output (if outputFormat provided) or the raw result
     */
    run<TOutput = unknown>(prompt: string, sessionId: string, options?: InternalRunOptions<TOutput>): Promise<TOutput>;
    /**
     * Execute the runner with callbacks wired up.
     */
    private executeWithCallbacks;
    /**
     * Type guard to validate message structure.
     * Ensures we're working with an SDKMessage from Anthropic's Claude Agent SDK.
     */
    private isSDKMessage;
    /**
     * Handle a message from the runner.
     *
     * Unlike BaseAnthropicAgent, this ONLY uses IUnifiedEventBus.
     * The legacy IEventBus is not supported per research.md Q4 decision.
     */
    private handleMessage;
    /**
     * Fire callbacks directly from generic message.
     *
     * This is a simplified version that maps directly from GenericMessage
     * to callbacks without going through the AgentEvent intermediate.
     */
    private fireCallbacksFromMessage;
    /**
     * Fire the onStart callback.
     */
    private fireOnStart;
    /**
     * Fire the onError callback.
     */
    private fireOnError;
    /**
     * Process the final result, firing onComplete callback.
     */
    private processResult;
    /**
     * Create a timeout promise.
     */
    private createTimeout;
}
