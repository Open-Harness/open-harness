/**
 * Workflow - Orchestrates multi-agent task execution
 */

import { inject, injectable } from "@needle-di/core";
import type { IAgentCallbacks } from "../callbacks/types.js";
import { CodingAgent } from "../providers/anthropic/agents/coding-agent.js";
import { ReviewAgent } from "../providers/anthropic/agents/review-agent.js";
import type { CodingResult } from "../providers/anthropic/runner/models.js";

export type Task = {
	id: string;
	description: string;
};

/**
 * Workflow options
 */
export interface WorkflowOptions {
	/** Callbacks for agent events */
	callbacks?: IAgentCallbacks<CodingResult>;
	/** Timeout per agent execution in ms */
	timeoutMs?: number;
}

@injectable()
export class Workflow {
	constructor(
		private coder: CodingAgent = inject(CodingAgent),
		private reviewer: ReviewAgent = inject(ReviewAgent),
	) {}

	/**
	 * Run all tasks through the coding and review pipeline.
	 *
	 * @param tasks - List of tasks to process
	 * @param options - Optional execution options
	 * @returns Promise that resolves when all tasks are complete
	 */
	async run(tasks: Task[], options?: WorkflowOptions): Promise<void> {
		for (const task of tasks) {
			console.log(`Starting Task: ${task.id}`);
			const sessionId = `session_${task.id}`;

			// 1. Coding Phase
			console.log(`Coding phase...`);
			const coderResult = await this.coder.execute(task.description, sessionId, {
				callbacks: options?.callbacks,
				timeoutMs: options?.timeoutMs,
			});

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
			const reviewResult = await this.reviewer.review(task.description, coderResult.summary, `${sessionId}_rev`, {
				timeoutMs: options?.timeoutMs,
			});

			if (reviewResult.decision === "approve") {
				console.log(`Task ${task.id} APPROVED and COMMITTED.`);
			} else {
				console.warn(`Task ${task.id} REJECTED: ${reviewResult.feedback}`);
				// In a real system, we'd loop back to Coder here
			}
		}
	}
}
