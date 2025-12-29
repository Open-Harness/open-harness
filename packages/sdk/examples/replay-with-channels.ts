/**
 * Replay with Channels - Complete example showing how to use fixtures
 *
 * This demonstrates:
 * 1. Using mode: "replay" to use fixtures instead of API calls
 * 2. Channels receive ALL events (agent + harness) even in replay
 * 3. Fast execution with zero API costs
 *
 * Run with: bun examples/replay-with-channels.ts
 */

import { defineAnthropicAgent } from "../../anthropic/src/index.js";
import { z } from "zod";
import { defineHarness, defineChannel } from "../src/index.js";
import { consoleChannel } from "../../channels/src/console/index.js";
import { clackChannel } from "../../channels/src/clack/index.js";

// ============================================================================
// DEFINE AGENTS
// ============================================================================

const PlannerAgent = defineAnthropicAgent({
	name: "Planner",
	prompt: "Create a task breakdown for: {{prd}}",
	inputSchema: z.object({ prd: z.string() }),
	outputSchema: z.object({
		tasks: z.array(
			z.object({
				id: z.string(),
				description: z.string(),
			}),
		),
	}),
	// Scenario ID tells ReplayRunner which fixture to use
	options: {
		model: "sonnet",
		scenarioId: "planner-todo-app", // Matches: tests/fixtures/golden/planner-todo-app.jsonl
	},
});

const CodingAgent = defineAnthropicAgent({
	name: "Coder",
	prompt: "Write code for: {{task}}",
	inputSchema: z.object({ task: z.string() }),
	outputSchema: z.object({ code: z.string() }),
	options: {
		model: "sonnet",
		scenarioId: "coder-simple-task", // Matches: tests/fixtures/golden/coder-simple-task.jsonl
	},
});

// ============================================================================
// DEFINE HARNESS
// ============================================================================

const TwoPhaseWorkflow = defineHarness({
	name: "two-phase-workflow",
	mode: "replay", // 👈 REPLAY MODE - Uses fixtures instead of API!
	agents: {
		planner: PlannerAgent,
		coder: CodingAgent,
	},
	state: () => ({
		tasks: [] as Array<{ id: string; description: string }>,
		code: [] as string[],
	}),
	run: async ({ agents, state, phase, task }) => {
		// Phase 1: Planning
		await phase("Planning", async () => {
			await task("generate-plan", async () => {
				// This uses the fixture at tests/fixtures/golden/planner-todo-app.jsonl
				const plan = await agents.planner.execute({ prd: "Build a TODO app" });
				state.tasks = plan.tasks;
				return plan;
			});
		});

		// Phase 2: Coding (iterate through tasks)
		await phase("Coding", async () => {
			for (const t of state.tasks) {
				await task(t.id, async () => {
					// This uses the fixture at tests/fixtures/golden/coder-simple-task.jsonl
					const result = await agents.coder.execute({ task: t.description });
					state.code.push(result.code);
					return result;
				});
			}
		});

		return {
			tasks: state.tasks,
			code: state.code,
		};
	},
});

// ============================================================================
// EVENT COUNTER CHANNEL
// ============================================================================

const eventCounterChannel = defineChannel({
	name: "EventCounter",
	state: () => ({
		counts: {} as Record<string, number>,
		total: 0,
	}),
	on: {
		"*": ({ state, event }: any) => {
			const type = event.event.type;
			state.counts[type] = (state.counts[type] || 0) + 1;
			state.total++;
		},
	},
	onComplete: ({ state }: any) => {
		console.log("\n📊 Event Summary:");
		console.log(`  Total events: ${state.total}`);
		console.log("\n  Breakdown:");
		for (const [type, count] of Object.entries(state.counts).sort()) {
			console.log(`    ${type}: ${count}`);
		}
		console.log("");
	},
});

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log("\n🔄 REPLAY MODE EXAMPLE");
	console.log("Using fixtures instead of real API calls\n");
	console.log("─".repeat(60));

	const startTime = Date.now();

	try {
		const result = await TwoPhaseWorkflow.create({})
			.attach(consoleChannel({ colors: true, timestamps: false, verbosity: "normal" }))
			.attach(clackChannel({ showTasks: true, showPhases: true }))
			.attach(eventCounterChannel)
			.run();

		const duration = Date.now() - startTime;

		console.log("\n✅ Workflow Complete!");
		console.log(`   Duration: ${duration}ms (⚡ No API latency!)`);
		console.log(`   Tasks generated: ${result.result.tasks.length}`);
		console.log(`   Code files generated: ${result.result.code.length}`);
		console.log(`   💰 API Cost: $0.00 (using fixtures)\n`);

		console.log("Expected behavior:");
		console.log("  ✅ Phase/task events from harness");
		console.log("  ✅ Agent events (agent:start, agent:text, etc.) from fixtures");
		console.log("  ✅ Tool call events from fixtures");
		console.log("  ✅ All events forwarded to channels\n");
	} catch (error) {
		console.error("\n❌ Error:", error);
		console.error("\nMost likely causes:");
		console.error("  1. Fixture not found - create tests/fixtures/golden/{scenarioId}.jsonl");
		console.error("  2. Fixture format invalid - check JSONL format");
		console.error("  3. Prompt mismatch - prompt must match recorded prompt\n");
	}
}

main().catch(console.error);
