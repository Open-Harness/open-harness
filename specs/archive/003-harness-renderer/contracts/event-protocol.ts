/**
 * Harness Event Protocol Contract
 *
 * Defines all events that flow between TaskHarness and IHarnessRenderer.
 * Uses discriminated unions for type-safe event handling.
 *
 * @module contracts/event-protocol
 */

import type { FailureRecord, HarnessSummary, TaskResult, ValidationResult } from "./summary-types";
import type { ParsedTask } from "./task-types";

// ============================================================================
// NARRATIVE TYPES
// ============================================================================

/** Valid agent names for narrative attribution */
export type AgentName = "Parser" | "Coder" | "Reviewer" | "Validator" | "Harness";

/**
 * A narrative entry from an agent's monologue.
 *
 * Replaces verbose tool call logs with human-readable progress.
 */
export interface NarrativeEntry {
	/** Unix timestamp in milliseconds */
	timestamp: number;
	/** Which agent produced this narrative */
	agentName: AgentName;
	/** Associated task ID, or null for harness-level */
	taskId: string | null;
	/** The human-readable narrative text */
	text: string;
}

/**
 * Metadata about narrative generation.
 */
export interface MonologueMetadata {
	/** Number of events that were summarized */
	eventCount: number;
	/** Current length of monologue history */
	historyLength: number;
	/** True if this is the final flush */
	isFinal?: boolean;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * All possible events emitted by TaskHarness.
 *
 * Events follow hierarchical naming:
 * - `harness:*` — Session lifecycle
 * - `phase:*` — Phase grouping
 * - `task:*` — Task execution
 * - `validation:*` — Validation
 */
export type HarnessEvent =
	| HarnessStartEvent
	| HarnessCompleteEvent
	| HarnessErrorEvent
	| PhaseStartEvent
	| PhaseCompleteEvent
	| TaskStartEvent
	| TaskNarrativeEvent
	| TaskCompleteEvent
	| TaskFailedEvent
	| TaskSkippedEvent
	| TaskRetryEvent
	| ValidationStartEvent
	| ValidationCompleteEvent
	| ValidationFailedEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Events
// ─────────────────────────────────────────────────────────────────────────────

export interface HarnessStartEvent {
	type: "harness:start";
	tasks: ParsedTask[];
	sessionId: string;
	mode: "live" | "replay";
}

export interface HarnessCompleteEvent {
	type: "harness:complete";
	summary: HarnessSummary;
}

export interface HarnessErrorEvent {
	type: "harness:error";
	error: Error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase Events
// ─────────────────────────────────────────────────────────────────────────────

export interface PhaseStartEvent {
	type: "phase:start";
	phase: string;
	phaseNumber: number;
	taskCount: number;
}

export interface PhaseCompleteEvent {
	type: "phase:complete";
	phaseNumber: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Execution Events
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskStartEvent {
	type: "task:start";
	task: ParsedTask;
}

export interface TaskNarrativeEvent {
	type: "task:narrative";
	taskId: string;
	entry: NarrativeEntry;
	metadata?: MonologueMetadata;
}

export interface TaskCompleteEvent {
	type: "task:complete";
	taskId: string;
	result: TaskResult;
}

export interface TaskFailedEvent {
	type: "task:failed";
	taskId: string;
	failure: FailureRecord;
}

export interface TaskSkippedEvent {
	type: "task:skipped";
	taskId: string;
	reason: string;
}

export interface TaskRetryEvent {
	type: "task:retry";
	taskId: string;
	attempt: number;
	maxAttempts: number;
	reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Events
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationStartEvent {
	type: "validation:start";
	taskId: string;
}

export interface ValidationCompleteEvent {
	type: "validation:complete";
	taskId: string;
	result: ValidationResult;
}

export interface ValidationFailedEvent {
	type: "validation:failed";
	taskId: string;
	failure: FailureRecord;
}
