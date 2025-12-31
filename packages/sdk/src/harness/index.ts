/**
 * Harness Index Exports
 *
 * Central export point for all harness primitives and types.
 * Provides a clean API surface for SDK users.
 */

// ============================================================================
// Core Utilities
// ============================================================================

// Backoff Utilities
export {
	type BackoffConfig,
	type BackoffContext,
	calculateDelay,
	createBackoffContext,
	DEFAULT_BACKOFF_CONFIG,
	isRateLimitError,
	shouldRetry,
	sleep,
	updateBackoffContext,
	withBackoff,
} from "./backoff.js";

// Dependency Resolver
export {
	detectCycles,
	type DependencyTask,
	getReadyTasks,
	resolveDependencies,
	type TopologicalSortResult,
	validateDependencies,
} from "./dependency-resolver.js";

// ============================================================================
// Fluent Harness API (007-fluent-harness-dx)
// ============================================================================

// Harness Instance - Runtime execution
export { HarnessInstance } from "./harness-instance.js";

// Event Types - All fluent harness events
export {
	type ErrorEvent,
	type FluentEventHandler,
	type FluentHarnessEvent,
	type HarnessEventType,
	type NarrativeEvent,
	type ParallelCompleteEvent,
	type ParallelEvent,
	type ParallelItemCompleteEvent,
	type ParallelOptions,
	type ParallelStartEvent,
	type PhaseEvent,
	type RetryAttemptEvent,
	type RetryBackoffEvent,
	type RetryEvent,
	type RetryFailureEvent,
	type RetryOptions,
	type RetryStartEvent,
	type RetrySuccessEvent,
	type SessionAbortEvent,
	type SessionEvent,
	type SessionPromptEvent,
	type SessionReplyEvent,
	type StepEvent,
	type TaskEvent,
} from "./event-types.js";

// Type Guards
export {
	isErrorEvent,
	isNarrativeEvent,
	isParallelEvent,
	isPhaseEvent,
	isRetryEvent,
	isSessionEvent,
	isStepEvent,
	isTaskEvent,
} from "./event-types.js";

// Control Flow Helpers
export {
	createParallelHelper,
	createRetryHelper,
	type EmitFn,
	parallel,
	retry,
} from "./control-flow.js";

// Session Context
export { SessionContext } from "./session-context.js";

// Types from unified-events
export type { InjectedMessage, WaitOptions } from "../core/unified-events/types.js";

// Async Queue
export { AsyncQueue } from "./async-queue.js";

// Event Context (re-exports from core)
export {
	type AgentContext,
	type EventContext,
	type PhaseContext,
	type TaskContext,
} from "./event-context.js";

// ============================================================================
// Channel System
// ============================================================================

// New Channel API
export {
	type ChannelConfig,
	type ChannelContext,
	type ChannelDefinition,
	type ChannelEventHandler,
	createChannel,
	defineChannel,
	type IChannel,
} from "./define-channel.js";

// Backwards compatibility (deprecated)
export {
	defineRenderer,
	type EventHandler,
	type IUnifiedRenderer,
	type RenderContext,
	type RendererConfig as UnifiedRendererConfig,
	type RendererDefinition,
	toAttachment,
} from "./define-channel.js";

// Render Output Helpers
export { RenderOutput, type RenderOutputConfig, type Spinner } from "./render-output.js";
