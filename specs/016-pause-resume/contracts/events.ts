/**
 * Event Contract: Pause/Resume Events
 *
 * This file defines the new event types emitted by Hub for pause/resume.
 * These events are observable through the standard channel infrastructure.
 *
 * Feature Branch: 016-pause-resume
 * Date: 2026-01-02
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// flow:paused Event
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emitted when hub.abort({ resumable: true }) is called.
 * External systems should capture sessionId for later resume.
 */
export const FlowPausedEventSchema = z.object({
	type: z.literal("flow:paused"),

	/** Session ID - use this to resume later */
	sessionId: z.string(),

	/** Node that was executing when pause was triggered */
	nodeId: z.string(),

	/** Human-readable reason for the pause */
	reason: z.string().optional(),
});

export type FlowPausedEvent = z.infer<typeof FlowPausedEventSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// flow:resumed Event
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emitted when hub.resume(sessionId) is called.
 * Indicates that execution is continuing from the paused state.
 */
export const FlowResumedEventSchema = z.object({
	type: z.literal("flow:resumed"),

	/** Session ID that was resumed */
	sessionId: z.string(),

	/** Node that is resuming execution */
	nodeId: z.string(),

	/** Number of messages that were injected during the pause period */
	injectedMessages: z.number().int().nonnegative(),
});

export type FlowResumedEvent = z.infer<typeof FlowResumedEventSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Event Filter Patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Event filter patterns for channel subscription.
 *
 * @example
 * hub.registerChannel({
 *   name: "pause-observer",
 *   on: {
 *     "flow:paused": ({ event }) => { ... },
 *     "flow:resumed": ({ event }) => { ... },
 *     "flow:*": ({ event }) => { ... }, // Both
 *   },
 * });
 */
export const PAUSE_RESUME_FILTERS = {
	/** Subscribe to pause events only */
	PAUSED: "flow:paused",

	/** Subscribe to resume events only */
	RESUMED: "flow:resumed",

	/** Subscribe to all pause/resume events */
	ALL: "flow:*",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Existing Events (for reference, not modified)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Existing session:abort event (unchanged).
 * Emitted when hub.abort() is called without resumable: true.
 * This is terminal - no session state is preserved.
 */
export const SessionAbortEventSchema = z.object({
	type: z.literal("session:abort"),
	reason: z.string().optional(),
});

export type SessionAbortEvent = z.infer<typeof SessionAbortEventSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Event Discriminated Union
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All pause/resume related events as a discriminated union.
 * Useful for type-safe event handling.
 *
 * @example
 * function handlePauseResumeEvent(event: PauseResumeEvent) {
 *   switch (event.type) {
 *     case "flow:paused":
 *       console.log(`Paused at node ${event.nodeId}`);
 *       break;
 *     case "flow:resumed":
 *       console.log(`Resumed at node ${event.nodeId}`);
 *       break;
 *   }
 * }
 */
export type PauseResumeEvent = FlowPausedEvent | FlowResumedEvent;

export const PauseResumeEventSchema = z.discriminatedUnion("type", [FlowPausedEventSchema, FlowResumedEventSchema]);
