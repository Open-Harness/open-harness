/**
 * Workflow - Orchestrates multi-agent task execution
 */

import { inject, injectable } from "@needle-di/core";
import { CodingAgent } from "../agents/coding-agent.js";
import { ReviewAgent } from "../agents/review-agent.js";
import type { StreamCallbacks } from "../runner/base-agent.js";

export type Task = {
	id: string;
	description: string;
};

@injectable()
export class Workflow {
	constructor(
		private coder: CodingAgent = inject(CodingAgent),
		private reviewer: ReviewAgent = inject(ReviewAgent),
	) {}

	/**
	 * Run all tasks through the coding and review pipeline.
	 *
	 * Callbacks are optional - pass them to observe agent events.
	 *
	 * @param tasks - List of tasks to process
	 * @param callbacks - Optional event callbacks for both agents
	 * @returns Promise that resolves when all tasks are complete
	 */
	async run(tasks: Task[], callbacks?: StreamCallbacks): Promise<void> {
		for (const task of tasks) {
			console.log(`Starting Task: ${task.id}`);
			const sessionId = `session_${task.id}`;

			// 1. Coding Phase
			console.log(`Coding phase...`);
			const coderResult = await this.coder.execute(task.description, sessionId, callbacks);

			console.log(`Coder finished with reason: ${coderResult.stopReason}`);

			if (coderResult.stopReason === "failed") {
				console.error(`Task ${task.id} BLOCKED: ${coderResult.summary}`);
				return; // Stop workflow on failure
			}

			if (coderResult.stopReason === "compact") {
				console.log(`Task ${task.id} needs compaction. Restarting...`);
				// In a real system, we'd handle state transfer here
				continue;
			}

			// 2. Review Phase
			console.log(`Reviewing implementation...`);
			const reviewResult = await this.reviewer.review(
				task.description,
				coderResult.summary,
				`${sessionId}_rev`,
				callbacks,
			);

			if (reviewResult.decision === "approve") {
				console.log(`Task ${task.id} APPROVED and COMMITTED.`);
			} else {
				console.warn(`Task ${task.id} REJECTED: ${reviewResult.feedback}`);
				// In a real system, we'd loop back to Coder here
			}
		}
	}
}
