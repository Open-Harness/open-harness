/**
 * PRD Workflow
 *
 * Main workflow assembly that wires together agents, reducers, and state.
 */

import type { ReactiveWorkflowResult, SignalRecordingOptions } from "@internal/core";
import { createWorkflow } from "@internal/core";
import type { Harness } from "@internal/signals-core";
import {
	createCoderAgent,
	createDiscoveryProcessorAgent,
	createPlanCreatorAgent,
	createReviewerAgent,
} from "./agents/index.js";
import { reducers } from "./reducers/index.js";
import { type CreateInitialStateOptions, createInitialState } from "./state.js";
import type { PRDWorkflowState } from "./types.js";

/**
 * Options for running a PRD workflow.
 */
export interface PRDWorkflowOptions extends CreateInitialStateOptions {
	/**
	 * Harness to use for agent execution.
	 */
	harness: Harness;

	/**
	 * Optional abort signal for cancellation.
	 */
	signal?: AbortSignal;

	/**
	 * Optional timeout in milliseconds.
	 */
	timeout?: number;

	/**
	 * Optional recording options for signal capture/replay.
	 */
	recording?: SignalRecordingOptions;
}

/**
 * Result from running a PRD workflow.
 */
export type PRDWorkflowResult = ReactiveWorkflowResult<PRDWorkflowState>;

/**
 * PRD Workflow runner.
 */
export interface PRDWorkflow {
	/**
	 * Run the workflow with a PRD document.
	 *
	 * @param prd - The PRD document to build from
	 * @param options - Workflow options
	 * @returns Workflow result with final state
	 */
	run: (prd: string, options: PRDWorkflowOptions) => Promise<PRDWorkflowResult>;
}

/**
 * Create a PRD workflow runner.
 *
 * @returns PRD workflow instance
 *
 * @example
 * ```ts
 * import { createPRDWorkflow } from "@open-harness/prd-workflow";
 * import { ClaudeHarness } from "@open-harness/core";
 *
 * const workflow = createPRDWorkflow();
 *
 * const result = await workflow.run(prdDocument, {
 *   harness: new ClaudeHarness(),
 * });
 *
 * if (result.state.workflowPhase === "complete") {
 *   console.log("PRD implementation complete!");
 * } else if (result.state.workflowPhase === "failed") {
 *   console.error("Workflow failed:", result.state.terminalFailure);
 * }
 * ```
 */
export function createPRDWorkflow(): PRDWorkflow {
	return {
		async run(prd: string, options: PRDWorkflowOptions): Promise<PRDWorkflowResult> {
			// Create workflow factory typed to PRDWorkflowState
			const { agent, runReactive } = createWorkflow<PRDWorkflowState>();

			// Create agents
			const planCreator = createPlanCreatorAgent(agent);
			const discoveryProcessor = createDiscoveryProcessorAgent(agent);
			const coder = createCoderAgent(agent);
			const reviewer = createReviewerAgent(agent);

			// Create initial state
			const initialState = createInitialState(prd, {
				maxReplans: options.maxReplans,
			});

			// Run the workflow
			return runReactive({
				agents: {
					planCreator,
					discoveryProcessor,
					coder,
					reviewer,
				},
				state: initialState,
				harness: options.harness,
				reducers,
				recording: options.recording,
				signal: options.signal,
				timeout: options.timeout,
				endWhen: (state) => state.workflowPhase === "complete" || state.workflowPhase === "failed",
			});
		},
	};
}
