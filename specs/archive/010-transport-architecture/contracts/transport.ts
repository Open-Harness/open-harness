/**
 * Transport Architecture - TypeScript Contracts
 *
 * This file defines the public API contracts for the Transport interface.
 * Implementation must conform to these interfaces.
 *
 * @module contracts/transport
 */

import type { EnrichedEvent, EventFilter, Unsubscribe } from "../../../packages/sdk/src/core/unified-events/types.js";

// ============================================================================
// TRANSPORT STATUS
// ============================================================================

/**
 * Transport execution status.
 *
 * State transitions:
 * - idle → running (on run() or complete())
 * - running → complete (normal completion)
 * - running → aborted (on abort())
 */
export type TransportStatus = "idle" | "running" | "complete" | "aborted";

// ============================================================================
// USER INTERACTION TYPES
// ============================================================================

/**
 * Response from user prompt.
 *
 * @property content - The user's text response
 * @property choice - Selected choice (if choices were presented)
 * @property timestamp - When the response was received
 */
export interface UserResponse {
	content: string;
	choice?: string;
	timestamp: Date;
}

/**
 * Options for waitForUser() prompt.
 *
 * @property timeout - Maximum wait time in ms (undefined = indefinite)
 * @property choices - Predefined choices to present
 * @property validator - Custom validation function
 */
export interface WaitOptions {
	timeout?: number;
	choices?: string[];
	validator?: (input: string) => boolean | string;
}

/**
 * Message injected via transport.send().
 */
export interface InjectedMessage {
	content: string;
	agent?: string;
	timestamp: Date;
}

// ============================================================================
// TRANSPORT INTERFACE
// ============================================================================

/**
 * Event listener callback type.
 */
export type EventListener = (event: EnrichedEvent) => void | Promise<void>;

/**
 * Bidirectional communication channel between harness and consumers.
 *
 * Provides:
 * - Events (out): subscribe(), async iteration
 * - Commands (in): send(), reply(), abort()
 * - Status: status, sessionActive
 */
export interface Transport extends AsyncIterable<EnrichedEvent> {
	// ═══════════════════════════════════════════════════════════════════════
	// EVENTS (OUT) - Harness → Consumer
	// ═══════════════════════════════════════════════════════════════════════

	/**
	 * Subscribe to events with optional filter.
	 *
	 * @param listener - Callback for events
	 * @returns Unsubscribe function
	 *
	 * @example
	 * ```typescript
	 * const unsub = transport.subscribe((event) => console.log(event));
	 * ```
	 */
	subscribe(listener: EventListener): Unsubscribe;

	/**
	 * Subscribe to filtered events.
	 *
	 * @param filter - Event type pattern(s): '*', 'task:*', ['agent:*', 'task:*']
	 * @param listener - Callback for matching events
	 * @returns Unsubscribe function
	 *
	 * @example
	 * ```typescript
	 * const unsub = transport.subscribe('task:*', (event) => console.log(event));
	 * ```
	 */
	subscribe(filter: EventFilter, listener: EventListener): Unsubscribe;

	/**
	 * Async iteration over all events.
	 *
	 * @example
	 * ```typescript
	 * for await (const event of transport) {
	 *   console.log(event);
	 * }
	 * ```
	 */
	[Symbol.asyncIterator](): AsyncIterator<EnrichedEvent>;

	// ═══════════════════════════════════════════════════════════════════════
	// COMMANDS (IN) - Consumer → Harness
	// ═══════════════════════════════════════════════════════════════════════

	/**
	 * Inject a user message into the execution.
	 *
	 * Messages are queued and available via session.readMessages().
	 * No-op if session mode not active.
	 *
	 * @param message - Message content
	 */
	send(message: string): void;

	/**
	 * Send message to a specific agent.
	 *
	 * No-op if session mode not active.
	 *
	 * @param agent - Target agent name
	 * @param message - Message content
	 */
	sendTo(agent: string, message: string): void;

	/**
	 * Reply to a user:prompt event.
	 *
	 * Resolves the pending waitForUser() promise.
	 * No-op if session mode not active or promptId unknown.
	 *
	 * @param promptId - ID from user:prompt event
	 * @param response - User's response
	 */
	reply(promptId: string, response: UserResponse): void;

	/**
	 * Request graceful abort.
	 *
	 * Sets abort flag, workflows can check via session.isAborted().
	 * Idempotent - second call is no-op.
	 *
	 * @param reason - Optional abort reason
	 */
	abort(reason?: string): void;

	// ═══════════════════════════════════════════════════════════════════════
	// STATUS
	// ═══════════════════════════════════════════════════════════════════════

	/**
	 * Current transport status.
	 */
	readonly status: TransportStatus;

	/**
	 * Whether session mode is active (commands processed).
	 */
	readonly sessionActive: boolean;
}

// ============================================================================
// ATTACHMENT INTERFACE
// ============================================================================

/**
 * Cleanup function returned by attachment.
 * May be sync or async.
 */
export type Cleanup = void | (() => void) | (() => Promise<void>);

/**
 * Something that attaches to a transport and does stuff.
 *
 * Could be: renderer, metrics collector, API bridge, logger,
 * interactive prompt handler, abort controller, etc.
 *
 * The framework doesn't categorize. Attachments have full
 * bidirectional access and can use either direction, both, or neither.
 *
 * @param transport - The transport to attach to
 * @returns Optional cleanup function
 *
 * @example
 * ```typescript
 * const consoleRenderer: Attachment = (transport) => {
 *   const unsub = transport.subscribe((event) => console.log(event));
 *   return unsub;
 * };
 * ```
 */
export type Attachment = (transport: Transport) => Cleanup;

// ============================================================================
// SESSION CONTEXT
// ============================================================================

/**
 * Session context available to workflows when in interactive mode.
 *
 * Only present in ExecuteContext when startSession() was called.
 */
export interface SessionContext {
	/**
	 * Block until user responds.
	 *
	 * Emits user:prompt event and waits for transport.reply().
	 *
	 * @param prompt - Prompt text to display
	 * @param options - Wait options
	 * @returns User's response
	 * @throws {Error} If timeout exceeded (when timeout option set)
	 */
	waitForUser(prompt: string, options?: WaitOptions): Promise<UserResponse>;

	/**
	 * Check for injected messages (non-blocking).
	 */
	hasMessages(): boolean;

	/**
	 * Retrieve and clear injected messages.
	 */
	readMessages(): InjectedMessage[];

	/**
	 * Check if abort was requested.
	 */
	isAborted(): boolean;
}

// ============================================================================
// HARNESS INSTANCE EXTENSION
// ============================================================================

/**
 * Extended HarnessInstance that implements Transport.
 *
 * @template TInput - Input type passed to create()
 * @template TResult - Result type from run()/complete()
 */
export interface HarnessInstance<TInput, TResult> extends Transport {
	/**
	 * Attach a consumer to this instance.
	 *
	 * @param attachment - Attachment function
	 * @returns this (for chaining)
	 * @throws {Error} If called after run() has started
	 */
	attach(attachment: Attachment): this;

	/**
	 * Run in fire-and-forget mode.
	 *
	 * Commands (send, reply) are ignored.
	 * Cleanup functions called on completion.
	 */
	run(): Promise<HarnessResult<TResult>>;

	/**
	 * Enable interactive mode.
	 *
	 * Must be called before complete().
	 * Enables command processing (send, reply, abort).
	 *
	 * @returns this (for chaining)
	 */
	startSession(): this;

	/**
	 * Complete interactive session.
	 *
	 * Only valid after startSession().
	 * Cleanup functions called on completion.
	 */
	complete(): Promise<HarnessResult<TResult>>;
}

/**
 * Result from harness execution.
 */
export interface HarnessResult<TResult> {
	result: TResult;
	duration: number;
	events: EnrichedEvent[];
}
