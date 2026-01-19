/**
 * PRD Workflow Runner
 *
 * Provides a pre-configured workflow runner using the unified Handler pattern.
 * Handlers combine state mutations and signal emissions in a single function,
 * replacing the separate reducers/processes CQRS pattern.
 *
 * @example
 * ```ts
 * import { runPRDWorkflow, createInitialState } from "@internal/prd-workflow";
 *
 * const result = await runPRDWorkflow({
 *   prd: "# My PRD\n\nBuild a todo app with...",
 *   agents: { planner, coder, reviewer },
 *   harness: myHarness,
 * });
 *
 * console.log(result.state.planning.allTasks);
 * ```
 */

import type { ScopedReactiveAgent, SignalRecordingOptions } from "@internal/core";
import { createWorkflow } from "@internal/core";
import type { Harness as SignalHarness } from "@internal/signals-core";

import { PRDWorkflowHandlers } from "./handlers/index.js";
import type { PRDWorkflowState } from "./types.js";
import { createInitialState } from "./types.js";

/**
 * Configuration for running a PRD workflow
 */
export interface PRDWorkflowConfig {
	/**
	 * The PRD content to process
	 */
	prd: string;

	/**
	 * Named agents to include in the workflow
	 */
	agents: Record<string, ScopedReactiveAgent<unknown, PRDWorkflowState>>;

	/**
	 * Default harness for agents
	 */
	harness?: SignalHarness;

	/**
	 * Abort signal for cancellation
	 */
	signal?: AbortSignal;

	/**
	 * Timeout in milliseconds
	 */
	timeout?: number;

	/**
	 * Termination condition
	 */
	endWhen?: (state: Readonly<PRDWorkflowState>) => boolean;

	/**
	 * Recording options
	 */
	recording?: SignalRecordingOptions;
}

/**
 * Create a workflow factory scoped to PRDWorkflowState.
 *
 * Use this to create agents that have typed access to PRD workflow state.
 *
 * @example
 * ```ts
 * const { agent } = createPRDWorkflow();
 *
 * const planner = agent({
 *   prompt: "Create a plan from the PRD",
 *   activateOn: ["workflow:start"],
 *   emits: ["plan:created"],
 *   when: (ctx) => ctx.state.planning.phase === "idle",
 * });
 * ```
 */
export function createPRDWorkflow() {
	return createWorkflow<PRDWorkflowState>();
}

/**
 * Run a PRD workflow with pre-configured unified handlers.
 *
 * This is a convenience wrapper that:
 * 1. Creates initial state from the PRD
 * 2. Attaches unified handlers (state mutations + signal emissions)
 * 3. Runs the reactive workflow
 *
 * Handlers replace the old CQRS pattern (separate reducers/processes)
 * with a unified approach where each handler can both mutate state
 * and return signals to emit.
 *
 * @example
 * ```ts
 * const { agent } = createPRDWorkflow();
 *
 * const planner = agent({
 *   prompt: "Analyze PRD and create tasks",
 *   activateOn: ["workflow:start"],
 *   emits: ["plan:created"],
 * });
 *
 * const result = await runPRDWorkflow({
 *   prd: "Build a REST API...",
 *   agents: { planner },
 *   harness: myHarness,
 * });
 * ```
 */
export async function runPRDWorkflow(config: PRDWorkflowConfig) {
	const { runReactive } = createWorkflow<PRDWorkflowState>();

	return runReactive({
		agents: config.agents,
		state: createInitialState(config.prd),
		harness: config.harness,
		signal: config.signal,
		timeout: config.timeout,
		endWhen: config.endWhen,
		recording: config.recording,
		// Unified Handler pattern: handlers do both state mutations AND signal emissions
		handlers: PRDWorkflowHandlers,
	});
}
