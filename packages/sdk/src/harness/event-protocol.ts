/**
 * Harness Event Protocol
 *
 * Defines all events that flow between TaskHarness and IHarnessRenderer.
 * Uses discriminated unions for type-safe event handling.
 *
 * @module harness/event-protocol
 */

import type { FailureRecord, HarnessSummary, TaskResult, ValidationResult } from "./task-harness-types.js";

// Re-export the ParsedTask type for convenience
export type { ParsedTask } from "./task-harness-types.js";

// ============================================================================
// VERBOSITY TYPES
// ============================================================================

/**
 * Verbosity level for filtering narratives and events.
 *
 * - `minimal`: Only critical status changes (start, complete, failed)
 * - `normal`: Standard progress updates (default)
 * - `verbose`: Detailed agent reasoning and intermediate steps
 */
export type VerbosityLevel = "minimal" | "normal" | "verbose";

/**
 * Importance level for individual narratives.
 * Used for filtering narratives based on renderer verbosity.
 *
 * - `critical`: Always shown (failures, completion)
 * - `important`: Shown at normal+ verbosity (key milestones)
 * - `detailed`: Shown only at verbose level (reasoning, steps)
 */
export type NarrativeImportance = "critical" | "important" | "detailed";

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
	/** Importance level for verbosity filtering (defaults to 'important') */
	importance?: NarrativeImportance;
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

import type { ParsedTask } from "./task-harness-types.js";

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

// ============================================================================
// EVENT TYPE GUARDS
// ============================================================================

/** Check if event is a lifecycle event */
export function isLifecycleEvent(
	event: HarnessEvent,
): event is HarnessStartEvent | HarnessCompleteEvent | HarnessErrorEvent {
	return event.type.startsWith("harness:");
}

/** Check if event is a phase event */
export function isPhaseEvent(event: HarnessEvent): event is PhaseStartEvent | PhaseCompleteEvent {
	return event.type.startsWith("phase:");
}

/** Check if event is a task event */
export function isTaskEvent(
	event: HarnessEvent,
): event is
	| TaskStartEvent
	| TaskNarrativeEvent
	| TaskCompleteEvent
	| TaskFailedEvent
	| TaskSkippedEvent
	| TaskRetryEvent {
	return event.type.startsWith("task:");
}

/** Check if event is a validation event */
export function isValidationEvent(
	event: HarnessEvent,
): event is ValidationStartEvent | ValidationCompleteEvent | ValidationFailedEvent {
	return event.type.startsWith("validation:");
}
