/**
 * Coding Workflow Harness
 *
 * A two-phase coding workflow using the Open Harness SDK:
 * - Phase 1: Planning - Break PRD into tickets using PlannerAgent
 * - Phase 2: Execution - Code and review each ticket using CodingAgent + ReviewAgent
 *
 * This demonstrates how to build harnesses OUTSIDE the SDK repo
 * using the full SDK agent system with DI container.
 */

import * as p from "@clack/prompts";
import {
	BaseHarness,
	CodingAgent,
	type CodingResult,
	createContainer,
	PlannerAgent,
	type PlannerResult,
	ReviewAgent,
	type ReviewResult,
	type StepYield,
	type Ticket,
} from "@openharnes/sdk";

// ============================================
// Types
// ============================================

interface CodingState {
	phase: "planning" | "execution" | "complete";

	// Phase 1: Planning
	prd: string;
	tickets: Ticket[];

	// Phase 2: Execution
	currentTicketIndex: number;
	completedTickets: string[];
	codeResults: Map<string, CodingResult>;
	reviewResults: Map<string, ReviewResult>;
}

// Input/Output for workflow steps
type WorkflowInput =
	| { type: "prd"; content: string }
	| { type: "code"; ticket: Ticket }
	| { type: "review"; ticket: Ticket; codeResult: CodingResult };

type WorkflowOutput = PlannerResult | CodingResult | ReviewResult;

// ============================================
// Harness
// ============================================

class CodingWorkflowHarness extends BaseHarness<CodingState, WorkflowInput, WorkflowOutput> {
	private planner: PlannerAgent;
	private coder: CodingAgent;
	private reviewer: ReviewAgent;

	constructor(prd: string) {
		super({
			initialState: {
				phase: "planning",
				prd,
				tickets: [],
				currentTicketIndex: 0,
				completedTickets: [],
				codeResults: new Map(),
				reviewResults: new Map(),
			},
		});

		// Create container with live runners - this wires up all SDK infrastructure
		const container = createContainer({ mode: "live" });

		// Get agents from container (DI handles runner injection)
		this.planner = container.get(PlannerAgent);
		this.coder = container.get(CodingAgent);
		this.reviewer = container.get(ReviewAgent);
	}

	protected async *execute(): AsyncGenerator<StepYield<WorkflowInput, WorkflowOutput>> {
		const state = this.state.getState();

		// ========================================
		// Phase 1: Planning
		// ========================================
		if (state.phase === "planning") {
			p.log.info("=== Phase 1: Planning ===");
			p.log.step(`Breaking PRD into tickets...`);

			const planResult = await this.planner.plan(state.prd, "workflow-session", {
				onText: () => process.stdout.write("."),
			});

			p.log.success(`\nGenerated ${planResult.tickets.length} tickets`);

			this.state.updateState((s) => ({
				...s,
				tickets: planResult.tickets,
				phase: "execution",
			}));

			yield {
				input: { type: "prd", content: state.prd },
				output: planResult,
			};
		}

		// ========================================
		// Phase 2: Execution
		// ========================================
		const execState = this.state.getState();
		if (execState.phase === "execution") {
			p.log.info("\n=== Phase 2: Execution ===");

			for (const ticket of execState.tickets) {
				p.log.step(`\n📋 Working on: ${ticket.title}`);

				// Step A: Code the ticket
				p.log.info(`  Coding ${ticket.id}...`);

				const codeResult = await this.coder.execute(
					`${ticket.title}\n\n${ticket.description}`,
					`workflow-session-${ticket.id}`,
					{
						onText: () => process.stdout.write("."),
						onToolCall: (name) => p.log.info(`\n  🔧 ${name}`),
					},
				);

				p.log.success(`\n  ✅ Code complete: ${codeResult.summary.slice(0, 80)}...`);

				this.state.updateState((s) => {
					const newCodeResults = new Map(s.codeResults);
					newCodeResults.set(ticket.id, codeResult);
					return { ...s, codeResults: newCodeResults };
				});

				yield {
					input: { type: "code", ticket },
					output: codeResult,
				};

				// Step B: Review the code
				p.log.info(`  Reviewing ${ticket.id}...`);

				const reviewResult = await this.reviewer.review(
					`${ticket.title}\n\n${ticket.description}`,
					codeResult.summary,
					`workflow-session-${ticket.id}-review`,
					{
						onText: () => process.stdout.write("."),
					},
				);

				const emoji = reviewResult.decision === "approve" ? "✅" : "❌";
				p.log.info(`\n  ${emoji} Review: ${reviewResult.decision}`);
				p.log.info(`  Feedback: ${reviewResult.feedback.slice(0, 100)}...`);

				this.state.updateState((s) => {
					const newReviewResults = new Map(s.reviewResults);
					newReviewResults.set(ticket.id, reviewResult);
					return {
						...s,
						reviewResults: newReviewResults,
						completedTickets: [...s.completedTickets, ticket.id],
						currentTicketIndex: s.currentTicketIndex + 1,
					};
				});

				yield {
					input: { type: "review", ticket, codeResult },
					output: reviewResult,
				};
			}

			this.state.updateState((s) => ({ ...s, phase: "complete" }));
		}
	}

	override isComplete(): boolean {
		const state = this.state.getState();
		return state.phase === "complete";
	}
}

// ============================================
// Main
// ============================================

async function main() {
	p.intro("🚀 Coding Workflow Harness");

	const prd = `
Build a simple TODO application with the following features:
1. Add new todo items
2. Mark items as complete
3. Delete items
	`.trim();

	p.log.info("Starting workflow with PRD:");
	console.log(prd);
	console.log();

	const harness = new CodingWorkflowHarness(prd);

	try {
		await harness.run();

		const finalState = harness.getState();

		p.log.success("\n=== Workflow Complete ===");
		p.log.info(`Tickets: ${finalState.tickets.length}`);
		p.log.info(`Completed: ${finalState.completedTickets.length}`);
		p.log.info(`Total steps: ${harness.getCurrentStep()}`);

		// Summary
		console.log("\n📊 Results:");
		for (const ticket of finalState.tickets) {
			const review = finalState.reviewResults.get(ticket.id);
			const status = review?.decision === "approve" ? "✅" : "❌";
			console.log(`  ${status} ${ticket.id}: ${ticket.title}`);
		}

		p.outro("✅ All done!");
	} catch (error) {
		p.cancel("Workflow failed");
		console.error(error);
		process.exit(1);
	}
}

if (import.meta.main) {
	main().catch(console.error);
}

export { CodingWorkflowHarness };
