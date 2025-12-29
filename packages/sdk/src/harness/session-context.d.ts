/**
 * SessionContext - Runtime context for interactive workflows
 *
 * Provides methods for workflows to interact with users during execution.
 * Created by HarnessInstance when session mode is active.
 *
 * @module harness/session-context
 */
import type { InjectedMessage, ISessionContext, UserResponse, WaitOptions } from "../infra/unified-events/types.js";
import type { AsyncQueue } from "../utils/async-queue.js";
/**
 * Deferred promise with external resolve/reject control.
 */
interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
}
/**
 * Dependencies passed from HarnessInstance to SessionContext.
 */
export interface SessionContextDeps {
    /** Queue for injected messages from transport.send() */
    messageQueue: AsyncQueue<InjectedMessage>;
    /** Map of pending prompt resolvers keyed by promptId */
    promptResolvers: Map<string, Deferred<UserResponse>>;
    /** Abort controller for graceful shutdown */
    abortController: AbortController;
    /** Callback to emit events through the harness */
    emitPrompt: (promptId: string, prompt: string, choices?: string[]) => void;
    /** Generate unique prompt ID */
    generatePromptId: () => string;
}
/**
 * Session context available to workflows when in interactive mode.
 *
 * Only present in ExecuteContext when startSession() was called.
 * Provides user interaction methods for HITL (Human-In-The-Loop) workflows.
 *
 * @example
 * ```typescript
 * // In a workflow:
 * const response = await ctx.session.waitForUser("Approve deployment?", {
 *   choices: ["Yes", "No"]
 * });
 *
 * if (response.choice === "Yes") {
 *   await deploy();
 * }
 * ```
 */
export declare class SessionContext implements ISessionContext {
    private readonly _messageQueue;
    private readonly _promptResolvers;
    private readonly _abortController;
    private readonly _emitPrompt;
    private readonly _generatePromptId;
    constructor(deps: SessionContextDeps);
    /**
     * Block until user responds.
     *
     * Emits session:prompt event and waits for transport.reply().
     *
     * @param prompt - Prompt text to display
     * @param options - Wait options (timeout, choices, validator)
     * @returns User's response
     * @throws {Error} If timeout exceeded (when timeout option set)
     * @throws {Error} If session is aborted
     */
    waitForUser(prompt: string, options?: WaitOptions): Promise<UserResponse>;
    /**
     * Check for injected messages (non-blocking).
     *
     * @returns true if messages are available
     */
    hasMessages(): boolean;
    /**
     * Retrieve and clear injected messages.
     *
     * Drains all messages from the queue and returns them.
     *
     * @returns Array of injected messages (may be empty)
     */
    readMessages(): InjectedMessage[];
    /**
     * Check if abort was requested.
     *
     * Workflows should check this periodically for graceful shutdown.
     *
     * @returns true if abort() was called on the transport
     */
    isAborted(): boolean;
}
export {};
