/**
 * Test All Events - Verify channels receive all event types
 *
 * Tests:
 * - Agent events (start, thinking, text, complete)
 * - Tool call events (tool:start, tool:complete)
 * - Narrative/monologue events
 * - Phase and task events
 */

import { injectable } from "@needle-di/core";
import { defineHarness, defineChannel } from "../src/index.js";

// Create a comprehensive debug channel that logs ALL events with details
const comprehensiveDebugChannel = defineChannel({
	name: "ComprehensiveDebug",
	state: () => ({
		eventCounts: {} as Record<string, number>,
		totalEvents: 0,
	}),
	on: {
		"*": ({ state, event }: any) => {
			const payload = event.event;
			const type = payload.type;

			// Count events
			state.eventCounts[type] = (state.eventCounts[type] || 0) + 1;
			state.totalEvents++;

			// Log event details
			console.log(`\n📢 [${state.totalEvents}] EVENT: ${type}`);
			console.log(`   Status: ${payload.status || 'N/A'}`);

			// Type-specific details
			if (type === "phase") {
				console.log(`   Phase: ${payload.name}`);
			} else if (type === "task") {
				console.log(`   Task: ${payload.id}`);
			} else if (type === "agent") {
				console.log(`   Agent: ${payload.agentName || 'unknown'}`);
				console.log(`   Action: ${payload.action || payload.status || 'unknown'}`);
			} else if (type === "agent:thinking") {
				console.log(`   Content: ${(payload.content || '').substring(0, 80)}...`);
			} else if (type === "agent:text") {
				console.log(`   Text: ${(payload.content || '').substring(0, 80)}...`);
			} else if (type === "agent:tool:start") {
				console.log(`   Tool: ${payload.toolName}`);
			} else if (type === "agent:tool:complete") {
				console.log(`   Tool: ${payload.toolName}`);
				console.log(`   Error: ${payload.isError || false}`);
			} else if (type === "narrative") {
				console.log(`   Text: ${payload.text}`);
				console.log(`   Importance: ${payload.importance || 'normal'}`);
			}
		},
	},
	onComplete: ({ state }: any) => {
		console.log("\n" + "=".repeat(60));
		console.log("📊 EVENT SUMMARY");
		console.log("=".repeat(60));
		console.log(`Total events: ${state.totalEvents}`);
		console.log("\nEvent breakdown:");
		for (const [type, count] of Object.entries(state.eventCounts).sort()) {
			console.log(`  ${type}: ${count}`);
		}
		console.log("=".repeat(60) + "\n");
	},
});

// Mock agent that simulates various events
@injectable()
class MockAgentWithEvents {
	async execute(input: string): Promise<{ result: string }> {
		// Simulate some work
		await new Promise(r => setTimeout(r, 100));
		return { result: `Processed: ${input}` };
	}
}

const TestHarness = defineHarness({
	name: "event-test",
	agents: {
		worker: MockAgentWithEvents,
	},
	state: () => ({ items: [] as string[] }),
	run: async ({ agents, state, phase, task }) => {
		// Phase 1: Basic tasks
		await phase("Basic Processing", async () => {
			await task("task-1", async () => {
				const result = await agents.worker.execute("item-1");
				state.items.push(result.result);
				return result;
			});

			await task("task-2", async () => {
				const result = await agents.worker.execute("item-2");
				state.items.push(result.result);
				return result;
			});
		});

		// Phase 2: More tasks
		await phase("Advanced Processing", async () => {
			await task("task-3", async () => {
				const result = await agents.worker.execute("item-3");
				state.items.push(result.result);
				return result;
			});
		});

		return {
			itemsProcessed: state.items.length,
			items: state.items,
		};
	},
});

async function main() {
	console.log("\n🔬 COMPREHENSIVE EVENT TEST");
	console.log("Testing all event types that should be emitted...\n");
	console.log("─".repeat(60));

	const result = await TestHarness.create(undefined)
		.attach(comprehensiveDebugChannel)
		.run();

	console.log("\n✅ Test complete!");
	console.log(`   Items processed: ${result.result.itemsProcessed}`);
	console.log(`   Duration: ${result.duration}ms\n`);

	console.log("Expected event types:");
	console.log("  ✓ phase (start/complete)");
	console.log("  ✓ task (start/complete/failed)");
	console.log("  ? agent (start/complete) - if agents emit these");
	console.log("  ? agent:thinking - if enabled");
	console.log("  ? agent:text - if enabled");
	console.log("  ? agent:tool:start - if tools used");
	console.log("  ? agent:tool:complete - if tools used");
	console.log("  ? narrative - if monologue enabled\n");
}

main().catch(console.error);
