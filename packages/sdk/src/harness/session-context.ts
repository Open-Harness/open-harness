/**
 * SessionContext - Runtime context for interactive workflows
 *
 * Provides methods for workflows to interact with users during execution.
 * Created by HarnessInstance when session mode is active.
 *
 * @module harness/session-context
 */

import type { InjectedMessage, ISessionContext, UserResponse, WaitOptions } from "../core/unified-events/types.js";
import type { AsyncQueue } from "./async-queue.js";

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
export class SessionContext implements ISessionContext {
	private readonly _messageQueue: AsyncQueue<InjectedMessage>;
	private readonly _promptResolvers: Map<string, Deferred<UserResponse>>;
	private readonly _abortController: AbortController;
	private readonly _emitPrompt: SessionContextDeps["emitPrompt"];
	private readonly _generatePromptId: SessionContextDeps["generatePromptId"];

	constructor(deps: SessionContextDeps) {
		this._messageQueue = deps.messageQueue;
		this._promptResolvers = deps.promptResolvers;
		this._abortController = deps.abortController;
		this._emitPrompt = deps.emitPrompt;
		this._generatePromptId = deps.generatePromptId;
	}

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
	async waitForUser(prompt: string, options?: WaitOptions): Promise<UserResponse> {
		// Check if already aborted
		if (this._abortController.signal.aborted) {
			throw new Error("Session aborted");
		}

		// Generate unique prompt ID
		const promptId = this._generatePromptId();

		// Create deferred promise for this prompt
		let resolve!: (value: UserResponse) => void;
		let reject!: (reason?: unknown) => void;
		const promise = new Promise<UserResponse>((res, rej) => {
			resolve = res;
			reject = rej;
		});

		const deferred: Deferred<UserResponse> = { promise, resolve, reject };
		this._promptResolvers.set(promptId, deferred);

		// Emit the prompt event
		this._emitPrompt(promptId, prompt, options?.choices);

		// Handle abort during wait
		const abortHandler = () => {
			this._promptResolvers.delete(promptId);
			reject(new Error("Session aborted"));
		};
		this._abortController.signal.addEventListener("abort", abortHandler, { once: true });

		try {
			// T062: Wait for response with optional timeout
			let response: UserResponse;

			if (options?.timeout && options.timeout > 0) {
				// Create timeout promise
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => {
						reject(new Error(`Prompt timed out after ${options.timeout}ms`));
					}, options.timeout);
				});

				// Race between response and timeout
				response = await Promise.race([promise, timeoutPromise]);
			} else {
				// No timeout - wait indefinitely
				response = await promise;
			}

			// Validate response if validator provided
			if (options?.validator) {
				const validationResult = options.validator(response.content);
				if (validationResult !== true) {
					const errorMessage = typeof validationResult === "string" ? validationResult : "Invalid response";
					throw new Error(errorMessage);
				}
			}

			return response;
		} finally {
			// Cleanup
			this._abortController.signal.removeEventListener("abort", abortHandler);
			this._promptResolvers.delete(promptId);
		}
	}

	/**
	 * Check for injected messages (non-blocking).
	 *
	 * @returns true if messages are available
	 */
	hasMessages(): boolean {
		return !this._messageQueue.isEmpty;
	}

	/**
	 * Retrieve and clear injected messages.
	 *
	 * Drains all messages from the queue and returns them.
	 *
	 * @returns Array of injected messages (may be empty)
	 */
	readMessages(): InjectedMessage[] {
		const messages: InjectedMessage[] = [];

		// Drain all messages from queue
		let message = this._messageQueue.tryPop();
		while (message !== undefined) {
			messages.push(message);
			message = this._messageQueue.tryPop();
		}

		return messages;
	}

	/**
	 * Check if abort was requested.
	 *
	 * Workflows should check this periodically for graceful shutdown.
	 *
	 * @returns true if abort() was called on the transport
	 */
	isAborted(): boolean {
		return this._abortController.signal.aborted;
	}
}
