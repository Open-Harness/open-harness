/**
 * Harness Event Types for Fluent API
 *
 * Defines all events for the fluent defineHarness() API.
 * Uses discriminated unions for type-safe event handling.
 *
 * @module harness/event-types
 */

// ============================================================================
// EVENT TYPE UNION
// ============================================================================

/**
 * All possible harness event types.
 * Use '*' for wildcard subscription to all events.
 */
export type HarnessEventType =
	| "phase"
	| "task"
	| "step"
	| "narrative"
	| "error"
	| "retry"
	| "parallel"
	| "session"
	| "*";

// ============================================================================
// CORE EVENT INTERFACES
// ============================================================================

/**
 * Phase lifecycle event.
 * Emitted by phase() helper or manual emit.
 */
export interface PhaseEvent {
	type: "phase";
	name: string;
	status: "start" | "complete" | "failed";
	timestamp: Date;
	data?: Record<string, unknown>;
	/** Present on 'complete' - return value of the phase function */
	result?: unknown;
	/** Present on 'failed' - error message */
	error?: string;
	/** Present on 'failed' - error stack trace */
	stack?: string;
}

/**
 * Task lifecycle event.
 * Emitted by task() helper.
 */
export interface TaskEvent {
	type: "task";
	id: string;
	status: "start" | "complete" | "failed";
	timestamp: Date;
	data?: Record<string, unknown>;
	/** Present on 'complete' - return value of the task function */
	result?: unknown;
	/** Present on 'failed' - error message */
	error?: string;
	/** Present on 'failed' - error stack trace */
	stack?: string;
}

/**
 * Step recording event.
 * Emitted via yield in execute() generator.
 */
export interface StepEvent {
	type: "step";
	step: string;
	input: unknown;
	output: unknown;
	timestamp: Date;
}

/**
 * Narrative event from @Monologue decorator.
 * Agent-generated LLM summaries of their work.
 */
export interface NarrativeEvent {
	type: "narrative";
	agent: string;
	text: string;
	timestamp: Date;
}

/**
 * Error event for exception handling.
 */
export interface ErrorEvent {
	type: "error";
	message: string;
	timestamp: Date;
	cause?: unknown;
	stack?: string;
}

// ============================================================================
// RETRY EVENT INTERFACES
// ============================================================================

/**
 * Retry start event - emitted when retry loop begins.
 */
export interface RetryStartEvent {
	type: "retry:start";
	name: string;
	maxAttempts: number;
	timestamp: Date;
}

/**
 * Retry attempt event - emitted before each attempt.
 */
export interface RetryAttemptEvent {
	type: "retry:attempt";
	name: string;
	attempt: number;
	maxAttempts: number;
	timestamp: Date;
}

/**
 * Retry backoff event - emitted when waiting before next attempt.
 */
export interface RetryBackoffEvent {
	type: "retry:backoff";
	name: string;
	attempt: number;
	delay: number;
	error: string;
	timestamp: Date;
}

/**
 * Retry success event - emitted when attempt succeeds.
 */
export interface RetrySuccessEvent {
	type: "retry:success";
	name: string;
	attempt: number;
	timestamp: Date;
	result?: unknown;
}

/**
 * Retry failure event - emitted when all attempts exhausted.
 */
export interface RetryFailureEvent {
	type: "retry:failure";
	name: string;
	attempts: number;
	error: string;
	timestamp: Date;
	stack?: string;
}

/**
 * Union of all retry events.
 */
export type RetryEvent =
	| RetryStartEvent
	| RetryAttemptEvent
	| RetryBackoffEvent
	| RetrySuccessEvent
	| RetryFailureEvent;

// ============================================================================
// PARALLEL EVENT INTERFACES
// ============================================================================

/**
 * Parallel start event - emitted when parallel execution begins.
 */
export interface ParallelStartEvent {
	type: "parallel:start";
	name: string;
	total: number;
	concurrency: number;
	timestamp: Date;
}

/**
 * Parallel item complete event - emitted when individual item completes.
 */
export interface ParallelItemCompleteEvent {
	type: "parallel:item:complete";
	name: string;
	index: number;
	completed: number;
	total: number;
	timestamp: Date;
}

/**
 * Parallel complete event - emitted when all items complete.
 */
export interface ParallelCompleteEvent {
	type: "parallel:complete";
	name: string;
	total: number;
	timestamp: Date;
}

/**
 * Union of all parallel events.
 */
export type ParallelEvent = ParallelStartEvent | ParallelItemCompleteEvent | ParallelCompleteEvent;

// ============================================================================
// SESSION EVENT INTERFACES (User Story 2)
// ============================================================================

/**
 * Session prompt event - emitted when workflow calls waitForUser().
 */
export interface SessionPromptEvent {
	type: "session:prompt";
	promptId: string;
	prompt: string;
	choices?: string[];
	timestamp: Date;
}

/**
 * Session reply event - emitted when transport.reply() resolves a prompt.
 */
export interface SessionReplyEvent {
	type: "session:reply";
	promptId: string;
	response: {
		content: string;
		choice?: string;
		timestamp: Date;
	};
	timestamp: Date;
}

/**
 * Session abort event - emitted when transport.abort() is called (T051).
 */
export interface SessionAbortEvent {
	type: "session:abort";
	/** Optional abort reason */
	reason?: string;
	timestamp: Date;
}

/**
 * Union of all session events.
 */
export type SessionEvent = SessionPromptEvent | SessionReplyEvent | SessionAbortEvent;

// ============================================================================
// HARNESS EVENT UNION
// ============================================================================

/**
 * Union of all harness events.
 * Used for type-safe event handling with discriminated unions.
 */
export type FluentHarnessEvent =
	| PhaseEvent
	| TaskEvent
	| StepEvent
	| NarrativeEvent
	| ErrorEvent
	| RetryEvent
	| ParallelEvent
	| SessionEvent;

// ============================================================================
// EVENT HANDLER TYPES
// ============================================================================

/**
 * Event handler signature.
 * Generic over event type for proper inference.
 */
export type FluentEventHandler<E extends HarnessEventType> = E extends "phase"
	? (event: PhaseEvent) => void
	: E extends "task"
		? (event: TaskEvent) => void
		: E extends "step"
			? (event: StepEvent) => void
			: E extends "narrative"
				? (event: NarrativeEvent) => void
				: E extends "error"
					? (event: ErrorEvent) => void
					: E extends "retry"
						? (event: RetryEvent) => void
						: E extends "parallel"
							? (event: ParallelEvent) => void
							: E extends "session"
								? (event: SessionEvent) => void
								: E extends "*"
									? (event: FluentHarnessEvent) => void
									: never;

// ============================================================================
// STEP YIELD (GENERATOR ONLY)
// ============================================================================

/**
 * Step yield for execute() generator.
 * Used for step recording and replay.
 */
export interface StepYield {
	step: string;
	input?: unknown;
	output?: unknown;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/** Check if event is a phase event */
export function isPhaseEvent(event: FluentHarnessEvent): event is PhaseEvent {
	return event.type === "phase";
}

/** Check if event is a task event */
export function isTaskEvent(event: FluentHarnessEvent): event is TaskEvent {
	return event.type === "task";
}

/** Check if event is a step event */
export function isStepEvent(event: FluentHarnessEvent): event is StepEvent {
	return event.type === "step";
}

/** Check if event is a narrative event */
export function isNarrativeEvent(event: FluentHarnessEvent): event is NarrativeEvent {
	return event.type === "narrative";
}

/** Check if event is an error event */
export function isErrorEvent(event: FluentHarnessEvent): event is ErrorEvent {
	return event.type === "error";
}

/** Check if event is a retry event */
export function isRetryEvent(event: FluentHarnessEvent): event is RetryEvent {
	return typeof event.type === "string" && event.type.startsWith("retry:");
}

/** Check if event is a parallel event */
export function isParallelEvent(event: FluentHarnessEvent): event is ParallelEvent {
	return typeof event.type === "string" && event.type.startsWith("parallel:");
}

/** Check if event is a session event */
export function isSessionEvent(event: FluentHarnessEvent): event is SessionEvent {
	return typeof event.type === "string" && event.type.startsWith("session:");
}

// ============================================================================
// CONTROL FLOW OPTIONS
// ============================================================================

/**
 * Options for retry() helper.
 */
export interface RetryOptions {
	/** Maximum retry attempts (default: 3) */
	retries?: number;
	/** Minimum backoff delay in ms (default: 1000) */
	minTimeout?: number;
	/** Maximum backoff delay in ms (default: 5000) */
	maxTimeout?: number;
}

/**
 * Options for parallel() helper.
 */
export interface ParallelOptions {
	/** Maximum concurrent executions (default: 5) */
	concurrency?: number;
}
