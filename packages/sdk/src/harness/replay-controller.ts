/**
 * ReplayController - Replays recorded harness sessions through a renderer
 *
 * Loads a recorded session and emits events with timing to simulate
 * the original execution. Supports speed control and pause/resume.
 *
 * @module harness/replay-controller
 */

import type { HarnessEvent } from "./event-protocol.js";
import { loadHarnessRun, type HarnessRun } from "./harness-recorder.js";
import type { IHarnessRenderer, RendererConfig } from "./renderer-interface.js";
import type { NarrativeEntry, ParsedTask } from "./task-harness-types.js";

/**
 * Configuration for replay controller.
 */
export interface ReplayControllerConfig {
	/** Renderer to output to */
	renderer: IHarnessRenderer;
	/** Speed multiplier (0 = instant, 1 = real-time, 2 = 2x speed) */
	speed?: number;
	/** Show timestamps in output */
	showTimestamps?: boolean;
	/** Callback for replay progress */
	onProgress?: (current: number, total: number) => void;
}

/**
 * Replay event - unified event for replay timing.
 */
interface ReplayEvent {
	/** Unix timestamp from the original recording */
	timestamp: number;
	/** The harness event to emit */
	event: HarnessEvent;
}

/**
 * ReplayController - Replays recorded harness sessions.
 *
 * @example
 * ```typescript
 * const controller = new ReplayController({
 *   renderer: new ConsoleRenderer(),
 *   speed: 2.0, // 2x speed
 * });
 *
 * await controller.loadSession('recordings/harness/session-123/run.json');
 * await controller.play();
 * ```
 */
export class ReplayController {
	private run: HarnessRun | null = null;
	private config: ReplayControllerConfig;
	private isPaused = false;
	private isStopped = false;
	private currentEventIndex = 0;

	constructor(config: ReplayControllerConfig) {
		this.config = {
			speed: 1.0,
			showTimestamps: false,
			...config,
		};
	}

	/**
	 * Load a recorded session from a run.json file.
	 *
	 * @param runPath - Path to the run.json file
	 */
	async loadSession(runPath: string): Promise<void> {
		this.run = await loadHarnessRun(runPath);
		this.currentEventIndex = 0;
		this.isPaused = false;
		this.isStopped = false;
	}

	/**
	 * Load a session from a HarnessRun object.
	 *
	 * @param run - The harness run data
	 */
	loadSessionData(run: HarnessRun): void {
		this.run = run;
		this.currentEventIndex = 0;
		this.isPaused = false;
		this.isStopped = false;
	}

	/**
	 * Play the loaded session.
	 *
	 * @returns Promise that resolves when replay completes
	 */
	async play(): Promise<void> {
		if (!this.run) {
			throw new Error("No session loaded. Call loadSession() first.");
		}

		const { renderer } = this.config;
		const speed = this.config.speed ?? 1.0;

		// Build parsed tasks from narratives (we don't have full task data in recordings)
		const tasks = this.buildTasksFromRecording(this.run);

		// Build replay events timeline
		const replayEvents = this.buildReplayTimeline(this.run, tasks);

		if (replayEvents.length === 0) {
			return;
		}

		// Initialize renderer
		const rendererConfig: RendererConfig = {
			mode: "replay",
			sessionId: this.run.sessionId,
			showTimestamps: this.config.showTimestamps,
			replaySpeed: speed,
		};

		await renderer.initialize(tasks, rendererConfig);

		// Play events with timing
		const startTime = replayEvents[0]?.timestamp ?? Date.now();
		const playbackStart = Date.now();

		for (let i = 0; i < replayEvents.length; i++) {
			if (this.isStopped) break;

			// Handle pause
			while (this.isPaused && !this.isStopped) {
				await this.sleep(100);
			}
			if (this.isStopped) break;

			const replayEvent = replayEvents[i];
			if (!replayEvent) continue;

			this.currentEventIndex = i;

			// Calculate delay based on speed
			if (speed > 0 && i > 0) {
				const previousEvent = replayEvents[i - 1];
				if (previousEvent) {
					const timeDelta = replayEvent.timestamp - previousEvent.timestamp;
					const scaledDelay = timeDelta / speed;

					if (scaledDelay > 0) {
						// Calculate how long we should have been playing
						const targetPlaybackTime = (replayEvent.timestamp - startTime) / speed;
						const actualPlaybackTime = Date.now() - playbackStart;
						const sleepTime = targetPlaybackTime - actualPlaybackTime;

						if (sleepTime > 0) {
							await this.sleep(Math.min(sleepTime, 5000)); // Cap at 5s
						}
					}
				}
			}

			// Emit the event
			renderer.handleEvent(replayEvent.event);

			// Progress callback
			this.config.onProgress?.(i + 1, replayEvents.length);
		}

		// Finalize renderer
		if (this.run.summary) {
			await renderer.finalize({
				totalTasks: this.run.summary.totalTasks,
				completedTasks: this.run.summary.completedTasks,
				validatedTasks: this.run.summary.validatedTasks,
				failedTasks: this.run.summary.failedTasks,
				skippedTasks: this.run.summary.skippedTasks,
				totalRetries: 0,
				durationMs: this.run.summary.durationMs,
				tokenUsage: {
					inputTokens: 0,
					outputTokens: 0,
					cacheReadInputTokens: 0,
					cacheCreationInputTokens: 0,
				},
			});
		}
	}

	/**
	 * Pause playback.
	 */
	pause(): void {
		this.isPaused = true;
	}

	/**
	 * Resume playback.
	 */
	resume(): void {
		this.isPaused = false;
	}

	/**
	 * Stop playback completely.
	 */
	stop(): void {
		this.isStopped = true;
		this.isPaused = false;
	}

	/**
	 * Get current playback state.
	 */
	getState(): { isPlaying: boolean; isPaused: boolean; currentEvent: number; totalEvents: number } {
		return {
			isPlaying: !this.isStopped && !this.isPaused,
			isPaused: this.isPaused,
			currentEvent: this.currentEventIndex,
			totalEvents: this.run ? this.run.events.length + this.run.narratives.length : 0,
		};
	}

	// =========================================================================
	// Private Methods
	// =========================================================================

	/**
	 * Build ParsedTask objects from recording data.
	 * Since recordings don't have full task data, we infer from events.
	 */
	private buildTasksFromRecording(run: HarnessRun): ParsedTask[] {
		const taskMap = new Map<
			string,
			{
				id: string;
				phase: string;
				description: string;
			}
		>();

		// Extract task info from events
		for (const event of run.events) {
			if (event.taskId && !taskMap.has(event.taskId)) {
				const data = event.data as Record<string, unknown> | undefined;
				taskMap.set(event.taskId, {
					id: event.taskId,
					phase: (data?.phase as string) ?? "Unknown",
					description: (data?.description as string) ?? event.taskId,
				});
			}
		}

		// Convert to ParsedTask array
		return Array.from(taskMap.values()).map((t) => ({
			id: t.id,
			phase: t.phase,
			phaseNumber: 1, // Unknown, default to 1
			description: t.description,
			validationCriteria: "",
			dependencies: [],
			filePaths: [],
			userStory: null,
			flags: { parallel: false, constitution: null },
			status: "pending" as const,
		}));
	}

	/**
	 * Build a timeline of replay events from recording.
	 */
	private buildReplayTimeline(run: HarnessRun, tasks: ParsedTask[]): ReplayEvent[] {
		const timeline: ReplayEvent[] = [];
		const taskMap = new Map(tasks.map((t) => [t.id, t]));

		// Add harness start event
		if (run.startTime) {
			timeline.push({
				timestamp: run.startTime,
				event: {
					type: "harness:start",
					tasks,
					sessionId: run.sessionId,
					mode: "replay",
				},
			});
		}

		// Process state events into harness events
		for (const stateEvent of run.events) {
			const harnessEvent = this.stateEventToHarnessEvent(stateEvent, taskMap);
			if (harnessEvent) {
				timeline.push({
					timestamp: stateEvent.timestamp,
					event: harnessEvent,
				});
			}
		}

		// Add narrative events
		for (const narrative of run.narratives) {
			if (narrative.taskId) {
				timeline.push({
					timestamp: narrative.timestamp,
					event: {
						type: "task:narrative",
						taskId: narrative.taskId,
						entry: {
							timestamp: narrative.timestamp,
							agentName: narrative.agentName as "Parser" | "Coder" | "Reviewer" | "Validator" | "Harness",
							taskId: narrative.taskId,
							text: narrative.text,
						},
					},
				});
			}
		}

		// Add harness complete event
		if (run.endTime && run.summary) {
			timeline.push({
				timestamp: run.endTime,
				event: {
					type: "harness:complete",
					summary: {
						...run.summary,
						totalRetries: 0,
						tokenUsage: {
							inputTokens: 0,
							outputTokens: 0,
							cacheReadInputTokens: 0,
							cacheCreationInputTokens: 0,
						},
					},
				},
			});
		}

		// Sort by timestamp
		timeline.sort((a, b) => a.timestamp - b.timestamp);

		return timeline;
	}

	/**
	 * Convert a state event to a harness event.
	 */
	private stateEventToHarnessEvent(
		stateEvent: HarnessRun["events"][number],
		taskMap: Map<string, ParsedTask>,
	): HarnessEvent | null {
		if (!stateEvent) return null;
		const data = stateEvent.data as Record<string, unknown> | undefined;

		switch (stateEvent.event) {
			case "task_started":
				if (stateEvent.taskId) {
					const task = taskMap.get(stateEvent.taskId);
					if (task) {
						return { type: "task:start", task };
					}
				}
				break;

			case "task_completed":
				if (stateEvent.taskId) {
					return {
						type: "task:complete",
						taskId: stateEvent.taskId,
						result: {
							taskId: stateEvent.taskId,
							success: true,
							summary: (data?.summary as string) ?? "Completed",
							filesModified: (data?.filesModified as string[]) ?? [],
							output: data?.output ?? {},
							durationMs: 0,
							tokenUsage: {
								inputTokens: 0,
								outputTokens: 0,
								cacheReadInputTokens: 0,
								cacheCreationInputTokens: 0,
							},
						},
					};
				}
				break;

			case "task_validated":
				if (stateEvent.taskId) {
					return {
						type: "validation:complete",
						taskId: stateEvent.taskId,
						result: {
							taskId: stateEvent.taskId,
							passed: true,
							reasoning: (data?.reasoning as string) ?? "Validated",
							suggestedFixes: [],
							confidence: (data?.confidence as number) ?? 1.0,
							uncertainties: [],
						},
					};
				}
				break;

			case "task_failed":
				if (stateEvent.taskId) {
					return {
						type: "task:failed",
						taskId: stateEvent.taskId,
						failure: {
							taskId: stateEvent.taskId,
							stage: (data?.stage as "coding" | "validation") ?? "coding",
							error: (data?.error as string) ?? "Failed",
							retryable: (data?.retryable as boolean) ?? false,
							timestamp: stateEvent.timestamp,
						},
					};
				}
				break;
		}

		return null;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
