/**
 * Coding Workflow Harness (Fluent API)
 *
 * Demonstrates 50%+ code reduction over the legacy pattern:
 * - No createContainer/container.get()
 * - Declarative agent config with auto-injection
 * - External event handling via .on()
 * - Auto-cleanup of subscriptions
 */

import {
	CodingAgent,
	type CodingOutput,
	PlannerAgent,
	type PlannerTask,
	ReviewAgent,
	type ReviewOutput,
} from "@openharness/anthropic/presets";
import { defineHarness } from "@openharness/sdk";

// State (shared between harness and external code)
interface CodingState {
	prd: string;
	tasks: PlannerTask[];
	codeResults: Map<string, CodingOutput>;
	reviewResults: Map<string, ReviewOutput>;
}

// Harness Definition - pure business logic
const CodingHarness = defineHarness({
	name: "coding-workflow",

	agents: { planner: PlannerAgent, coder: CodingAgent, reviewer: ReviewAgent },

	state: (input: { prd: string }): CodingState => ({
		prd: input.prd,
		tasks: [],
		codeResults: new Map(),
		reviewResults: new Map(),
	}),

	run: async ({ agents, state, phase, task }, _input) => {
		/*
		 * Phase 1: Planning
		 * - this phase is responsible for planning the tasks
		 * - this is stored in the state.tasks array
		 */
		await phase("Planning", async () => {
			const plan = await agents.planner.execute({ prd: state.prd });
			state.tasks = plan.tasks;
			return { count: plan.tasks.length };
		});

		/*
		 * Phase 2: Execution
		 * - this phase is responsible for executing the tasks
		 * - this is stored in the state.codeResults map
		 */
		await phase("Execution", async () => {
			for (const plannerTask of state.tasks) {
				await task(plannerTask.id, async () => {
					const code = await agents.coder.execute({
						task: `${plannerTask.title}\n${plannerTask.description}`,
					});
					state.codeResults.set(plannerTask.id, code);

					const review = await agents.reviewer.execute({
						task: `${plannerTask.title}\n${plannerTask.description}`,
						implementationSummary: code.explanation,
					});
					state.reviewResults.set(plannerTask.id, review);
					return { passed: review.approved };
				});
			}
		});

		return { tasks: state.tasks, reviewResults: state.reviewResults };
	},
});

export { CodingHarness as CodingWorkflow, type CodingState };
