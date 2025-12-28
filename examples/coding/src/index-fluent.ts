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
	type CodingResult,
	defineHarness,
	PlannerAgent,
	ReviewAgent,
	type ReviewResult,
	type Ticket,
} from "@openharness/sdk";

// State (shared between harness and external code)
interface CodingState {
	prd: string;
	tickets: Ticket[];
	codeResults: Map<string, CodingResult>;
	reviewResults: Map<string, ReviewResult>;
}

// Harness Definition - pure business logic
const CodingWorkflow = defineHarness({
	name: "coding-workflow",

	agents: { planner: PlannerAgent, coder: CodingAgent, reviewer: ReviewAgent },

	state: (input: { prd: string }): CodingState => ({
		prd: input.prd,
		tickets: [],
		codeResults: new Map(),
		reviewResults: new Map(),
	}),

	run: async ({ agents, state, phase, task }) => {
		await phase("Planning", async () => {
			const plan = await agents.planner.plan(state.prd, "session");
			state.tickets = plan.tickets;
			return { count: plan.tickets.length };
		});

		await phase("Execution", async () => {
			for (const ticket of state.tickets) {
				await task(ticket.id, async () => {
					const code = await agents.coder.execute(`${ticket.title}\n${ticket.description}`, `session-${ticket.id}`);
					state.codeResults.set(ticket.id, code);

					const review = await agents.reviewer.review(
						`${ticket.title}\n${ticket.description}`,
						code.summary,
						`session-${ticket.id}-review`,
					);
					state.reviewResults.set(ticket.id, review);
					return { passed: review.decision === "approve" };
				});
			}
		});

		return { tickets: state.tickets, reviewResults: state.reviewResults };
	},
});

export { CodingWorkflow, type CodingState };

// ============================================
// Main (example usage with console rendering)
// ============================================

async function main() {
	const prd = `Build a TODO app: add items, mark complete, delete items`;

	const result = await CodingWorkflow.create({ prd })
		.on("phase", (e) => console.log(`[${e.status}] Phase: ${e.name}`))
		.on("task", (e) => console.log(`  [${e.status}] ${e.id}`))
		.on("narrative", (e) => console.log(`  💭 ${e.text}`))
		.run();

	console.log(`\nComplete! ${result.result.tickets.length} tickets processed.`);
	for (const t of result.result.tickets) {
		const r = result.result.reviewResults.get(t.id);
		console.log(`  ${r?.decision === "approve" ? "✓" : "✗"} ${t.title}`);
	}
}

if (import.meta.main) {
	main().catch(console.error);
}
