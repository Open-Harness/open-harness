/**
 * Harness Renderer Interface Contract
 *
 * This file defines the contract that all renderers must implement.
 * It's the primary extension point for custom visualization.
 *
 * @module contracts/renderer-interface
 */

import type { HarnessEvent } from "./event-protocol";
import type { HarnessSummary } from "./summary-types";
import type { ParsedTask } from "./task-types";

// ============================================================================
// RENDERER CONFIGURATION
// ============================================================================

/**
 * Configuration passed to renderers during initialization.
 */
export interface RendererConfig {
	/**
	 * Execution mode:
	 * - `live`: Real-time execution (shows spinners, streaming output)
	 * - `replay`: Playing back a recorded session
	 */
	mode: "live" | "replay";

	/** Unique identifier for this session */
	sessionId: string;

	/** Show timestamps on events (default: false) */
	showTimestamps?: boolean;

	/**
	 * Collapse completed phases/tasks to single lines.
	 * Useful for long runs. (default: false)
	 */
	collapseCompleted?: boolean;

	/** Show token usage in summary (default: false) */
	showTokenUsage?: boolean;

	/**
	 * Replay speed multiplier:
	 * - 1.0 = real-time
	 * - 2.0 = 2x speed
	 * - 0 = instant
	 * Only applies in replay mode. (default: 1.0)
	 */
	replaySpeed?: number;
}

// ============================================================================
// RENDERER INTERFACE
// ============================================================================

/**
 * IHarnessRenderer - The core renderer interface.
 *
 * This minimal 3-method interface defines the contract between a harness
 * and its renderer. Renderers consume events and produce visual output.
 *
 * ## Lifecycle
 *
 * ```
 * initialize() ──► handleEvent()* ──► finalize()
 *                  (many times)
 * ```
 *
 * ## Implementation Guidelines
 *
 * - `initialize`: Set up display structure, open file handles, etc.
 * - `handleEvent`: Called synchronously for each event. Keep it fast.
 * - `finalize`: Cleanup, print summaries, wait for async work.
 *
 * @example
 * ```typescript
 * class MyRenderer implements IHarnessRenderer {
 *   initialize(tasks, config) {
 *     console.log(`Starting with ${tasks.length} tasks`);
 *   }
 *
 *   handleEvent(event) {
 *     if (event.type === 'task:narrative') {
 *       console.log(event.entry.text);
 *     }
 *   }
 *
 *   finalize(summary) {
 *     console.log(`Done: ${summary.validatedTasks} validated`);
 *   }
 * }
 * ```
 */
export interface IHarnessRenderer {
	/**
	 * Initialize the renderer with the full task list.
	 *
	 * Called once at the start of a harness run.
	 *
	 * @param tasks - All tasks that will be executed
	 * @param config - Renderer configuration
	 */
	initialize(tasks: ParsedTask[], config: RendererConfig): void | Promise<void>;

	/**
	 * Handle a harness event.
	 *
	 * Called synchronously for each event during execution.
	 * Events arrive in logical order (task:start before task:complete).
	 *
	 * @param event - The event to handle
	 */
	handleEvent(event: HarnessEvent): void;

	/**
	 * Finalize and cleanup.
	 *
	 * Called once at the end of a harness run.
	 *
	 * @param summary - Final statistics for the run
	 */
	finalize(summary: HarnessSummary): void | Promise<void>;
}

// ============================================================================
// RENDER STATE (for BaseHarnessRenderer)
// ============================================================================

/** Display status for a task */
export type TaskDisplayStatus = "pending" | "running" | "complete" | "failed" | "skipped" | "retrying";

/** Display status for validation */
export type ValidationDisplayStatus = "pending" | "running" | "passed" | "failed";

/**
 * Mutable render state for a single task.
 *
 * BaseHarnessRenderer maintains this and updates it as events arrive.
 */
export interface TaskRenderState {
	displayStatus: TaskDisplayStatus;
	narrative: string;
	validationStatus: ValidationDisplayStatus;
	retryCount: number;
	startTime?: number;
	endTime?: number;
}

/**
 * Mutable render state for a phase.
 */
export interface PhaseRenderState {
	name: string;
	phaseNumber: number;
	taskIds: string[];
	isComplete: boolean;
	isCollapsed: boolean;
}
