/**
 * Harness Recorder - Recording and replay for TaskHarness sessions
 *
 * Provides:
 * - State event logging to JSONL format
 * - Session capture for replay
 * - Checkpoint resume from recorded state
 *
 * @module harness/harness-recorder
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import type { HarnessSummary, NarrativeEntry, TaskHarnessState } from "./task-harness-types.js";

// ============================================================================
// Schemas
// ============================================================================

/**
 * Event types for state logging.
 */
export const StateEventTypeSchema = z.enum([
	"harness_started",
	"tasks_parsed",
	"task_started",
	"task_completed",
	"task_validated",
	"task_failed",
	"harness_completed",
	"harness_aborted",
]);
export type StateEventType = z.infer<typeof StateEventTypeSchema>;

/**
 * State event logged to JSONL.
 */
export const StateEventSchema = z.object({
	/** Unix timestamp */
	timestamp: z.number(),
	/** Event type */
	event: StateEventTypeSchema,
	/** Session ID */
	sessionId: z.string(),
	/** Task ID if applicable */
	taskId: z.string().nullable(),
	/** Additional event data */
	data: z.record(z.string(), z.unknown()).optional(),
	/** State snapshot (optional, for checkpointing) */
	stateSnapshot: z.unknown().optional(),
});
export type StateEvent = z.infer<typeof StateEventSchema>;

/**
 * Complete harness run record for replay.
 */
export const HarnessRunSchema = z.object({
	/** Session identifier */
	sessionId: z.string(),
	/** Start timestamp */
	startTime: z.number(),
	/** End timestamp (null if still running) */
	endTime: z.number().nullable(),
	/** Path to tasks.md file */
	tasksFilePath: z.string(),
	/** Final summary */
	summary: z
		.object({
			totalTasks: z.number(),
			completedTasks: z.number(),
			validatedTasks: z.number(),
			failedTasks: z.number(),
			skippedTasks: z.number(),
			durationMs: z.number(),
		})
		.nullable(),
	/** All state events */
	events: z.array(StateEventSchema),
	/** All narrative entries */
	narratives: z.array(
		z.object({
			timestamp: z.number(),
			agentName: z.string(),
			taskId: z.string().nullable(),
			text: z.string(),
		}),
	),
});
export type HarnessRun = z.infer<typeof HarnessRunSchema>;

// ============================================================================
// HarnessRecorder
// ============================================================================

/**
 * Configuration for HarnessRecorder.
 */
export interface HarnessRecorderConfig {
	/** Base directory for recordings */
	recordingsDir: string;
	/** Session ID for this run */
	sessionId: string;
	/** Whether to include state snapshots in events */
	includeSnapshots?: boolean;
}

/**
 * HarnessRecorder - Records and replays harness sessions.
 *
 * @example
 * ```typescript
 * const recorder = new HarnessRecorder({
 *   recordingsDir: 'recordings/harness',
 *   sessionId: 'harness-abc123',
 * });
 *
 * // Record events during execution
 * await recorder.logEvent('task_started', 'T001', { description: 'Setup' });
 * await recorder.logEvent('task_completed', 'T001', { success: true });
 *
 * // Save final run data
 * await recorder.saveRun(summary, narratives);
 * ```
 */
export class HarnessRecorder {
	private sessionDir: string;
	private stateLogPath: string;
	private runPath: string;
	private events: StateEvent[] = [];
	private narratives: NarrativeEntry[] = [];
	private startTime: number;

	constructor(private config: HarnessRecorderConfig) {
		this.sessionDir = path.join(config.recordingsDir, config.sessionId);
		this.stateLogPath = path.join(this.sessionDir, "state.jsonl");
		this.runPath = path.join(this.sessionDir, "run.json");
		this.startTime = Date.now();
	}

	/**
	 * Initialize the recording directory.
	 */
	async initialize(): Promise<void> {
		await fs.mkdir(this.sessionDir, { recursive: true });
	}

	/**
	 * Log a state event.
	 */
	async logEvent(
		event: StateEventType,
		taskId: string | null,
		data?: Record<string, unknown>,
		stateSnapshot?: TaskHarnessState,
	): Promise<void> {
		const stateEvent: StateEvent = {
			timestamp: Date.now(),
			event,
			sessionId: this.config.sessionId,
			taskId,
			data,
			stateSnapshot: this.config.includeSnapshots ? stateSnapshot : undefined,
		};

		this.events.push(stateEvent);

		// Append to JSONL file
		const line = `${JSON.stringify(stateEvent)}\n`;
		await fs.appendFile(this.stateLogPath, line);
	}

	/**
	 * Record a narrative entry.
	 */
	recordNarrative(entry: NarrativeEntry): void {
		this.narratives.push(entry);
	}

	/**
	 * Save the complete run data.
	 */
	async saveRun(tasksFilePath: string, summary: HarnessSummary | null): Promise<void> {
		const run: HarnessRun = {
			sessionId: this.config.sessionId,
			startTime: this.startTime,
			endTime: Date.now(),
			tasksFilePath,
			summary: summary
				? {
						totalTasks: summary.totalTasks,
						completedTasks: summary.completedTasks,
						validatedTasks: summary.validatedTasks,
						failedTasks: summary.failedTasks,
						skippedTasks: summary.skippedTasks,
						durationMs: summary.durationMs,
					}
				: null,
			events: this.events,
			narratives: this.narratives,
		};

		await fs.writeFile(this.runPath, JSON.stringify(run, null, 2));
	}

	/**
	 * Get the session directory path.
	 */
	getSessionDir(): string {
		return this.sessionDir;
	}
}

// ============================================================================
// Replay and Resume
// ============================================================================

/**
 * Load a recorded harness run.
 *
 * @param runPath - Path to run.json file
 * @returns Parsed HarnessRun
 */
export async function loadHarnessRun(runPath: string): Promise<HarnessRun> {
	const content = await fs.readFile(runPath, "utf-8");
	return HarnessRunSchema.parse(JSON.parse(content));
}

/**
 * Load state events from JSONL file.
 *
 * @param statePath - Path to state.jsonl file
 * @returns Array of state events
 */
export async function loadStateEvents(statePath: string): Promise<StateEvent[]> {
	const content = await fs.readFile(statePath, "utf-8");
	const lines = content.trim().split("\n").filter(Boolean);

	return lines.map((line) => StateEventSchema.parse(JSON.parse(line)));
}

/**
 * Reconstruct checkpoint from state events.
 *
 * Finds the last state with a snapshot and returns:
 * - List of validated task IDs (to skip)
 * - List of failed task IDs
 * - Last event index for resumption
 *
 * @param events - State events to analyze
 * @returns Checkpoint info
 */
export function reconstructCheckpoint(events: StateEvent[]): {
	validatedTaskIds: Set<string>;
	failedTaskIds: Set<string>;
	completedTaskIds: Set<string>;
	lastEventIndex: number;
} {
	const validatedTaskIds = new Set<string>();
	const failedTaskIds = new Set<string>();
	const completedTaskIds = new Set<string>();
	let lastEventIndex = -1;

	for (let i = 0; i < events.length; i++) {
		const event = events[i];
		if (!event) continue;
		lastEventIndex = i;

		if (event.taskId) {
			switch (event.event) {
				case "task_completed":
					completedTaskIds.add(event.taskId);
					break;
				case "task_validated":
					validatedTaskIds.add(event.taskId);
					break;
				case "task_failed":
					failedTaskIds.add(event.taskId);
					break;
			}
		}
	}

	return {
		validatedTaskIds,
		failedTaskIds,
		completedTaskIds,
		lastEventIndex,
	};
}

/**
 * Check if a harness run can be resumed.
 *
 * @param sessionDir - Path to session directory
 * @returns True if state.jsonl exists and can be parsed
 */
export async function canResume(sessionDir: string): Promise<boolean> {
	const statePath = path.join(sessionDir, "state.jsonl");
	try {
		await fs.access(statePath);
		const events = await loadStateEvents(statePath);
		// Check if we have a started event but no completed event
		const hasStarted = events.some((e) => e.event === "harness_started");
		const hasCompleted = events.some((e) => e.event === "harness_completed");
		return hasStarted && !hasCompleted;
	} catch {
		return false;
	}
}
