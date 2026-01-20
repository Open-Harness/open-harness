/**
 * PRD Workflow Renderer Map
 *
 * Defines how to render PRD workflow signals to the terminal.
 * This moves presentation logic from signals to adapter configuration,
 * following the principle "Signals are data, not presentation."
 *
 * Each renderer receives a typed signal and returns a formatted string
 * that the terminal adapter will write to stdout.
 *
 * @example
 * ```ts
 * import { prdRenderers } from "./renderers.js";
 * import { terminalAdapter } from "@internal/signals/adapters";
 *
 * const adapter = terminalAdapter({ renderers: prdRenderers });
 * ```
 */

import type { RendererMap, SignalRenderer } from "@internal/signals/adapters";
import type { Signal } from "@internal/signals-core";
import type {
	DiscoveryReviewedPayload,
	DiscoverySubmittedPayload,
	FixRequiredPayload,
	MilestoneFailedPayload,
	MilestonePassedPayload,
	MilestoneRetryPayload,
	MilestoneTestablePayload,
	PlanCreatedPayload,
	TaskApprovedPayload,
	TaskCompletePayload,
	TaskReadyPayload,
	WorkflowCompletePayload,
} from "./signals/index.js";

// ============================================================================
// Type Helper
// ============================================================================

/**
 * Create a typed renderer function that is compatible with RendererMap.
 *
 * The RendererMap uses SignalRenderer<unknown>, but we want to write renderers
 * with typed payloads for better DX. This helper casts the typed renderer to
 * the unknown-payload version that RendererMap expects.
 *
 * @typeParam T - The expected payload type
 * @param renderer - A renderer function expecting Signal<T>
 * @returns The same function cast to SignalRenderer (unknown payload)
 */
function renderer<T>(fn: (signal: Signal<T>) => string): SignalRenderer {
	return fn as SignalRenderer;
}

// ============================================================================
// ANSI Color Codes
// ============================================================================

const ANSI = {
	reset: "\x1b[0m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	dim: "\x1b[2m",
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Pluralize a word based on count
 */
function plural(count: number, singular: string, pluralForm?: string): string {
	return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}

// ============================================================================
// PRD Workflow Renderers
// ============================================================================

/**
 * Renderer map for all PRD workflow signals.
 *
 * Signal names map to renderer functions that format the signal for terminal output.
 * Each renderer has access to the typed signal payload.
 */
export const prdRenderers: RendererMap = {
	// ─────────────────────────────────────────────────────────────────────────
	// Planning Phase
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * plan:start - Begin the planning phase
	 */
	"plan:start": () => `${ANSI.blue}📋${ANSI.reset} Planning...`,

	/**
	 * plan:created - Plan has been generated with tasks and milestones
	 */
	"plan:created": renderer<PlanCreatedPayload>((signal) => {
		const { tasks, milestones } = signal.payload;
		const taskCount = tasks.length;
		const milestoneCount = milestones.length;
		return `${ANSI.green}✓${ANSI.reset} Plan created with ${taskCount} ${plural(taskCount, "task")} (${milestoneCount} ${plural(milestoneCount, "milestone")})`;
	}),

	// ─────────────────────────────────────────────────────────────────────────
	// Discovery Phase
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * discovery:submitted - New tasks discovered during execution
	 */
	"discovery:submitted": renderer<DiscoverySubmittedPayload>((signal) => {
		const { count } = signal.payload;
		return `${ANSI.yellow}🔍${ANSI.reset} ${count} ${plural(count, "task")} discovered`;
	}),

	/**
	 * discovery:reviewed - Discovered tasks have been reviewed
	 */
	"discovery:reviewed": renderer<DiscoveryReviewedPayload>((signal) => {
		const { accepted, rejected } = signal.payload;
		return `${ANSI.green}✓${ANSI.reset} ${accepted} accepted, ${rejected} rejected`;
	}),

	// ─────────────────────────────────────────────────────────────────────────
	// Task Execution
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * task:ready - A task is ready for execution
	 */
	"task:ready": renderer<TaskReadyPayload>((signal) => {
		const { title } = signal.payload;
		return `${ANSI.yellow}▶${ANSI.reset} ${title}`;
	}),

	/**
	 * task:complete - A task has been completed
	 */
	"task:complete": renderer<TaskCompletePayload>((signal) => {
		const { taskId, outcome } = signal.payload;
		const icon = outcome === "success" ? `${ANSI.green}✓` : `${ANSI.red}✗`;
		return `${icon}${ANSI.reset} Task ${taskId} ${outcome}`;
	}),

	/**
	 * task:approved - A task has passed review
	 */
	"task:approved": renderer<TaskApprovedPayload>((signal) => {
		const { taskId } = signal.payload;
		const taskInfo = taskId ? ` ${taskId}` : "";
		return `${ANSI.green}✓${ANSI.reset} Task${taskInfo} approved`;
	}),

	/**
	 * fix:required - A task needs fixing
	 */
	"fix:required": renderer<FixRequiredPayload>((signal) => {
		const { taskId, attempt } = signal.payload;
		return `${ANSI.yellow}🔧${ANSI.reset} Fixing task ${taskId} (attempt ${attempt})`;
	}),

	// ─────────────────────────────────────────────────────────────────────────
	// Milestones
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * milestone:testable - A milestone is ready for testing
	 */
	"milestone:testable": renderer<MilestoneTestablePayload>((signal) => {
		const { milestoneId } = signal.payload;
		return `${ANSI.blue}🧪${ANSI.reset} Testing milestone ${milestoneId}`;
	}),

	/**
	 * milestone:passed - A milestone has passed all tests
	 */
	"milestone:passed": renderer<MilestonePassedPayload>((signal) => {
		const { milestoneId } = signal.payload;
		return `${ANSI.green}✓${ANSI.reset} Milestone ${milestoneId} passed`;
	}),

	/**
	 * milestone:failed - A milestone has failed testing
	 */
	"milestone:failed": renderer<MilestoneFailedPayload>((signal) => {
		const { milestoneId } = signal.payload;
		return `${ANSI.red}✗${ANSI.reset} Milestone ${milestoneId} failed`;
	}),

	/**
	 * milestone:retry - A milestone is being retried
	 */
	"milestone:retry": renderer<MilestoneRetryPayload>((signal) => {
		const { milestoneId } = signal.payload;
		return `${ANSI.yellow}🔄${ANSI.reset} Retrying milestone ${milestoneId}`;
	}),

	// ─────────────────────────────────────────────────────────────────────────
	// Workflow
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * workflow:complete - The workflow has completed
	 */
	"workflow:complete": renderer<WorkflowCompletePayload>((signal) => {
		const { reason } = signal.payload;
		const message = reason === "all_milestones_passed" ? "All milestones passed!" : reason;
		return `${ANSI.green}🎉${ANSI.reset} ${message}`;
	}),
};
