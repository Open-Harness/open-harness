/**
 * Test Real Agent Events - Verify channels receive all event types from Anthropic agents
 *
 * Tests:
 * - Agent events (agent:start, agent:thinking, agent:text, agent:complete)
 * - Tool call events (agent:tool:start, agent:tool:complete)
 * - Phase and task events
 *
 * This uses a REAL Anthropic agent (not a mock) to emit actual agent events.
 */

import { defineAnthropicAgent } from "../../anthropic/src/index.js";
import { z } from "zod";
import { defineHarness, defineChannel } from "../src/index.js";

// ============================================================================
// REAL ANTHROPIC AGENT WITH TOOLS
// ============================================================================

const FileAnalyzer = defineAnthropicAgent({
	name: "FileAnalyzer",
	prompt: `You are a file analyzer. Analyze the given filename and provide insights.

Use the provided tool to "read" the file metadata, then provide a summary.`,
	inputSchema: z.object({
		filename: z.string(),
	}),
	outputSchema: z.object({
		analysis: z.string(),
		fileType: z.string(),
	}),
	tools: [
		{
			name: "get_file_metadata",
			description: "Get metadata about a file (simulated)",
			input_schema: {
				type: "object" as const,
				properties: {
					filename: {
						type: "string" as const,
						description: "The filename to analyze",
					},
				},
				required: ["filename"],
			},
		},
	],
});

// ============================================================================
// COMPREHENSIVE DEBUG CHANNEL
// ============================================================================

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
			console.log(`   Status: ${payload.status || "N/A"}`);

			// Type-specific details
			if (type === "phase") {
				console.log(`   Phase: ${payload.name}`);
			} else if (type === "task") {
				console.log(`   Task: ${payload.id}`);
			} else if (type === "agent:start") {
				console.log(`   Agent: ${payload.agentName || "unknown"}`);
			} else if (type === "agent:thinking") {
				console.log(`   Thinking: ${(payload.content || "").substring(0, 80)}...`);
			} else if (type === "agent:text") {
				console.log(`   Text: ${(payload.content || "").substring(0, 80)}...`);
			} else if (type === "agent:tool:start") {
				console.log(`   Tool: ${payload.toolName}`);
				console.log(`   Input: ${JSON.stringify(payload.input)}`);
			} else if (type === "agent:tool:complete") {
				console.log(`   Tool: ${payload.toolName}`);
				console.log(`   Error: ${payload.isError || false}`);
			} else if (type === "agent:complete") {
				console.log(`   Agent: ${payload.agentName || "unknown"}`);
				console.log(`   Success: ${payload.success}`);
			} else if (type === "narrative") {
				console.log(`   Text: ${payload.text}`);
				console.log(`   Importance: ${payload.importance || "normal"}`);
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

// ============================================================================
// HARNESS
// ============================================================================

const TestHarness = defineHarness({
	name: "agent-event-test",
	agents: {
		analyzer: FileAnalyzer,
	},
	state: () => ({ results: [] as string[] }),
	run: async ({ agents, state, phase, task }) => {
		await phase("File Analysis", async () => {
			await task("analyze-config", async () => {
				const result = await agents.analyzer.execute({
					filename: "config.json",
				});
				state.results.push(result.analysis);
				return result;
			});

			await task("analyze-data", async () => {
				const result = await agents.analyzer.execute({
					filename: "data.csv",
				});
				state.results.push(result.analysis);
				return result;
			});
		});

		return {
			filesAnalyzed: state.results.length,
			results: state.results,
		};
	},
});

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log("\n🔬 REAL AGENT EVENT TEST");
	console.log("Testing with actual Anthropic agent that makes tool calls...\n");
	console.log("─".repeat(60));

	const result = await TestHarness.create(undefined)
		.attach(comprehensiveDebugChannel)
		.run();

	console.log("\n✅ Test complete!");
	console.log(`   Files analyzed: ${result.result.filesAnalyzed}`);
	console.log(`   Duration: ${result.duration}ms\n`);

	console.log("Expected event types:");
	console.log("  ✓ phase (start/complete)");
	console.log("  ✓ task (start/complete/failed)");
	console.log("  ✓ agent:start - SHOULD appear now with real agent");
	console.log("  ✓ agent:thinking - SHOULD appear with extended thinking");
	console.log("  ✓ agent:text - SHOULD appear with text responses");
	console.log("  ✓ agent:tool:start - SHOULD appear when tools are called");
	console.log("  ✓ agent:tool:complete - SHOULD appear after tool results");
	console.log("  ✓ agent:complete - SHOULD appear when agent finishes\n");
}

main().catch(console.error);
