// Protocol: FlowRuntime
// See docs/reference/protocol-types.md for authoritative definitions

import { z } from "zod";
import type { EnrichedEvent } from "./events.js";
import type { Hub, HubStatus } from "./hub.js";

export type Cleanup = void | (() => void) | (() => Promise<void>);
export type Attachment = (hub: Hub) => Cleanup;

export interface FlowRunResult {
	outputs: Record<string, unknown>;
	events: EnrichedEvent[];
	durationMs: number;
	status: HubStatus;
}

export interface FlowRuntimeInstance extends Hub {
	attach(attachment: Attachment): this;
	startSession(): this;
	run(): Promise<FlowRunResult>;
}

/**
 * Captures the complete execution state at pause point.
 * Enables resume from exactly where execution stopped.
 */
export interface SessionState {
	sessionId: string;
	flowName: string;
	currentNodeId: string;
	currentNodeIndex: number;
	outputs: Record<string, unknown>;
	pendingMessages: string[];
	pausedAt: Date;
	pauseReason?: string;
}

/**
 * Request to resume a paused session with injected message.
 * Message is required - SDK needs user input to continue.
 */
export interface ResumeRequest {
	sessionId: string;
	message: string;
}

// Zod Schemas

export const SessionStateSchema = z.object({
	sessionId: z.string().min(1),
	flowName: z.string().min(1),
	currentNodeId: z.string().min(1),
	currentNodeIndex: z.number().int().nonnegative(),
	outputs: z.record(z.string(), z.unknown()),
	pendingMessages: z.array(z.string()),
	pausedAt: z.date(),
	pauseReason: z.string().optional(),
});

export const PauseOptionsSchema = z.object({
	resumable: z.boolean().optional(),
	reason: z.string().optional(),
});

export const ResumeRequestSchema = z.object({
	sessionId: z.string().min(1),
	message: z.string().min(1),
});
