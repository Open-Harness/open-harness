/**
 * Hub API Contract: Pause/Resume Extension
 *
 * This file defines the TypeScript interface extensions for pause/resume functionality.
 * It serves as the contract between Hub protocol and implementation.
 *
 * Feature Branch: 016-pause-resume
 * Date: 2026-01-02
 *
 * Validated against codebase 2026-01-02:
 * - Existing Hub interface: packages/kernel/src/protocol/hub.ts
 * - Existing HubImpl: packages/kernel/src/engine/hub.ts
 * - Existing SessionContext: packages/kernel/src/protocol/session.ts
 * - Existing abort(): engine/hub.ts:146-153 (to be extended)
 */

import type { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Pause Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for hub.abort() when requesting a pause.
 *
 * @example
 * // Terminal abort (existing behavior)
 * hub.abort();
 * hub.abort("User cancelled");
 *
 * // Resumable pause (new behavior)
 * hub.abort({ resumable: true });
 * hub.abort({ resumable: true, reason: "Waiting for user input" });
 */
export interface PauseOptions {
	/**
	 * If true, the flow is paused (resumable) rather than aborted (terminal).
	 * - true: Emits flow:paused, status becomes "paused", state preserved
	 * - false/omitted: Emits session:abort, status becomes "aborted", no state
	 * @default false
	 */
	resumable?: boolean;

	/**
	 * Human-readable reason for the pause/abort.
	 * Included in the emitted event for debugging/logging.
	 */
	reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Captured state of a paused flow execution.
 * Stored in Hub's _pausedSessions Map, restored on resume.
 */
export interface SessionState {
	/** Unique identifier for this paused session */
	sessionId: string;

	/** Name of the flow being executed */
	flowName: string;

	/** ID of the node that was executing when pause triggered */
	currentNodeId: string;

	/** Position in topologically sorted execution order (enables resume) */
	currentNodeIndex: number;

	/** Accumulated outputs from completed nodes */
	outputs: Record<string, unknown>;

	/** Messages injected while paused, delivered on resume via session:message */
	pendingMessages: string[];

	/** Timestamp when pause occurred */
	pausedAt: Date;

	/** Optional human-readable reason for pause */
	pauseReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hub Status Extension
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended hub status including "paused" state.
 * Existing values: "idle" | "running" | "complete" | "aborted"
 * New value: "paused"
 */
export type HubStatus = "idle" | "running" | "paused" | "complete" | "aborted";

// ─────────────────────────────────────────────────────────────────────────────
// Hub Interface Extension
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended Hub interface with pause/resume capability.
 *
 * Note: This extends the existing Hub interface. Implementation should
 * maintain backward compatibility with existing abort(reason?: string) calls.
 */
export interface HubPauseResumeExtension {
	/**
	 * Current hub status including "paused" state.
	 */
	readonly status: HubStatus;

	/**
	 * Stop execution.
	 *
	 * Overload 1 (existing): Terminal abort
	 * @param reason - Optional reason string
	 *
	 * Overload 2 (new): Configurable pause/abort
	 * @param options - Pause options including resumable flag
	 *
	 * @example
	 * // Terminal abort (backward compatible)
	 * hub.abort();
	 * hub.abort("User cancelled");
	 *
	 * // Resumable pause
	 * hub.abort({ resumable: true });
	 * hub.abort({ resumable: true, reason: "Awaiting input" });
	 */
	abort(reason?: string): void;
	abort(options: PauseOptions): void;

	/**
	 * Resume a paused flow with a message.
	 *
	 * @param sessionId - ID of the paused session (from flow:paused event)
	 * @param message - Message to inject before resuming (required - SDK needs user input to continue)
	 * @throws Error if sessionId is not found in paused sessions
	 *
	 * @example
	 * // Resume with user's response
	 * hub.resume("session-abc123", "Here's the information you requested");
	 *
	 * // Resume with continuation prompt
	 * hub.resume("session-abc123", "Please continue");
	 */
	resume(sessionId: string, message: string): void;

	/**
	 * Get the abort signal for cooperative cancellation.
	 * Executor and agent nodes use this to check for pause/abort.
	 *
	 * @returns The current session's AbortSignal
	 *
	 * @example
	 * // In executor between nodes
	 * if (hub.getAbortSignal().aborted) {
	 *   // Handle pause/abort
	 * }
	 *
	 * // In agent node
	 * await sdk.run({ signal: hub.getAbortSignal() });
	 */
	getAbortSignal(): AbortSignal;

	/**
	 * Query a paused session's state (for debugging/inspection).
	 *
	 * @param sessionId - ID of the paused session
	 * @returns SessionState if found, undefined if not paused
	 */
	getPausedSession(sessionId: string): SessionState | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emitted when a flow is paused (resumable=true).
 * Contains session ID for later resume.
 */
export interface FlowPausedEvent {
	type: "flow:paused";
	sessionId: string;
	nodeId: string;
	reason?: string;
}

/**
 * Emitted when a paused flow resumes execution.
 */
export interface FlowResumedEvent {
	type: "flow:resumed";
	sessionId: string;
	nodeId: string;
	/** Number of messages that were injected during pause */
	injectedMessages: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error thrown when attempting to resume a non-existent session.
 */
export class SessionNotFoundError extends Error {
	constructor(public readonly sessionId: string) {
		super(`Session "${sessionId}" not found in paused sessions`);
		this.name = "SessionNotFoundError";
	}
}

/**
 * Error thrown when attempting to resume an already-running session.
 */
export class SessionAlreadyRunningError extends Error {
	constructor(public readonly sessionId: string) {
		super(`Session "${sessionId}" is already running`);
		this.name = "SessionAlreadyRunningError";
	}
}
