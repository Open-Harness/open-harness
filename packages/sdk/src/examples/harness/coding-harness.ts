/**
 * Coding Harness Example
 *
 * Demonstrates task-completion pattern with custom isComplete() override.
 * Shows how to use BaseHarness for finite work queues.
 */

import { BaseHarness, Agent } from "../../harness/index.js";

interface CodingState {
	ticketsRemaining: number;
	completed: string[];
}

interface Ticket {
	id: string;
	title: string;
}

interface CodeResult {
	success: boolean;
	filesChanged: string[];
}

/**
 * Example: Coding harness with task-completion pattern
 * Shows custom isComplete() override and state updates during execute()
 */
class CodingHarness extends BaseHarness<CodingState, Ticket, CodeResult> {
	private coder = new Agent<CodingState, Ticket, CodeResult>({
		name: "Coder",
		async run({ input, stepNumber }) {
			console.log(`Step ${stepNumber}: Implementing ${input.title} (${input.id})`);
			// Simulate coding work
			return { success: true, filesChanged: [`${input.id}.ts`] };
		},
	});

	private ticketQueue: Ticket[] = [
		{ id: "TICK-1", title: "Add login" },
		{ id: "TICK-2", title: "Fix bug" },
		{ id: "TICK-3", title: "Write tests" },
	];

	async *execute() {
		while (this.ticketQueue.length > 0) {
			const input = this.ticketQueue.shift()!;

			const context = this.loadContext();
			const output = await this.coder.run({
				input,
				context: context.state,
				stepNumber: this.currentStep + 1,
				stepHistory: this.getStepHistory(),
				constraints: {},
			});

			// Update state
			this.state.updateState((s) => ({
				ticketsRemaining: s.ticketsRemaining - 1,
				completed: [...s.completed, input.id],
			}));

			yield { input, output };
		}
	}

	override isComplete(): boolean {
		return this.state.getState().ticketsRemaining <= 0;
	}
}

// Export for testing
export { CodingHarness, CodingState, Ticket, CodeResult };

// ============ EXECUTABLE MAIN ============
// Run with: bun packages/sdk/src/examples/harness/coding-harness.ts

async function main() {
	console.log("Starting Coding Harness Demo...\n");

	const harness = new CodingHarness({
		initialState: { ticketsRemaining: 3, completed: [] },
	});

	await harness.run();

	console.log("\n=== Coding Complete ===");
	console.log(`Final state:`, harness.getState());
	console.log(`Completed tickets:`, harness.getState().completed);
}

// Run if executed directly
if (import.meta.main) {
	main().catch(console.error);
}

