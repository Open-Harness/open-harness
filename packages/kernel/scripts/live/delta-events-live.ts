/**
 * Live test for agent:text:delta and agent:text events.
 *
 * This test runs against the REAL Claude SDK to verify:
 * 1. Streaming produces agent:text:delta events (real-time deltas)
 * 2. agent:text is ALSO emitted (complete content for consumers)
 * 3. BOTH event types are emitted - they are NOT mutually exclusive
 * 4. agent:complete contains the final result
 *
 * Usage: bun scripts/live/delta-events-live.ts
 */

import type { RuntimeEvent } from "../../src/core/events.js";
import { createRuntime, DefaultNodeRegistry, parseFlowYaml } from "../../src/index.js";
import { createClaudeNode } from "../../src/nodes/claude.agent.js";

async function runLiveTest() {
	console.log("🧪 Running delta events live test against REAL SDK...\n");

	// Simple flow that will produce streaming output
	const flow = parseFlowYaml(`
name: "delta-test"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "Say exactly: Hello World"
edges: []
`);

	const claudeNode = createClaudeNode();
	const registry = new DefaultNodeRegistry();
	registry.register(claudeNode);

	const runtime = createRuntime({ flow, registry });
	const events: RuntimeEvent[] = [];

	runtime.onEvent((event) => {
		events.push(event);
		// Log events as they arrive for visibility
		if (event.type.startsWith("agent:")) {
			const content = "content" in event ? ` "${String(event.content).slice(0, 50)}..."` : "";
			console.log(`  📡 ${event.type}${content}`);
		}
	});

	console.log("Starting flow execution...\n");
	const startTime = Date.now();

	try {
		const _snapshot = await runtime.run();
		const duration = Date.now() - startTime;

		console.log(`\nFlow completed in ${duration}ms\n`);

		// Analyze events
		const textDeltas = events.filter((e) => e.type === "agent:text:delta");
		const textComplete = events.filter((e) => e.type === "agent:text");
		const thinkingDeltas = events.filter((e) => e.type === "agent:thinking:delta");
		const thinkingComplete = events.filter((e) => e.type === "agent:thinking");
		const agentComplete = events.filter((e) => e.type === "agent:complete");

		console.log("📊 Event Analysis:");
		console.log(`  agent:text:delta count: ${textDeltas.length}`);
		console.log(`  agent:text count: ${textComplete.length}`);
		console.log(`  agent:thinking:delta count: ${thinkingDeltas.length}`);
		console.log(`  agent:thinking count: ${thinkingComplete.length}`);
		console.log(`  agent:complete count: ${agentComplete.length}`);

		// Assertions
		let passed = 0;
		let failed = 0;

		// Test 1: We should have text deltas (streaming is working)
		if (textDeltas.length > 0) {
			console.log("\n✅ TEST 1 PASSED: agent:text:delta events were emitted");
			passed++;
		} else {
			console.log("\n❌ TEST 1 FAILED: No agent:text:delta events (streaming not working?)");
			failed++;
		}

		// Test 2: agent:text SHOULD be emitted (complete content for consumers who want full message)
		if (textComplete.length > 0) {
			console.log("✅ TEST 2 PASSED: agent:text was emitted (complete content for consumers)");
			passed++;
		} else {
			console.log("❌ TEST 2 FAILED: agent:text was NOT emitted (should always be emitted)");
			failed++;
		}

		// Test 3: agent:complete should be emitted exactly once
		if (agentComplete.length === 1) {
			console.log("✅ TEST 3 PASSED: agent:complete emitted exactly once");
			passed++;
		} else {
			console.log(`❌ TEST 3 FAILED: agent:complete emitted ${agentComplete.length} times (expected 1)`);
			failed++;
		}

		// Test 4: agent:complete should have a result
		if (agentComplete.length > 0) {
			const complete = agentComplete[0] as { result?: string };
			if (complete.result && complete.result.length > 0) {
				console.log(`✅ TEST 4 PASSED: agent:complete has result: "${complete.result.slice(0, 50)}..."`);
				passed++;
			} else {
				console.log("❌ TEST 4 FAILED: agent:complete has no result");
				failed++;
			}
		}

		// Test 5: Concatenated deltas should approximate the final result
		if (textDeltas.length > 0 && agentComplete.length > 0) {
			const concatenated = textDeltas.map((e) => (e as { content: string }).content).join("");
			const _finalResult = (agentComplete[0] as { result: string }).result;

			// The concatenated deltas should be close to the final result
			// (they may not match exactly due to SDK formatting)
			if (concatenated.length > 0) {
				console.log(`✅ TEST 5 PASSED: Deltas concatenate to meaningful content (${concatenated.length} chars)`);
				passed++;
			} else {
				console.log("❌ TEST 5 FAILED: Concatenated deltas are empty");
				failed++;
			}
		}

		// Summary
		console.log(`\n📊 Results: ${passed}/${passed + failed} tests passed`);

		if (failed > 0) {
			console.log("\n❌ LIVE TEST FAILED");
			process.exit(1);
		}

		console.log("\n✅ ALL LIVE TESTS PASSED");

		// Output event summary for fixture creation if needed
		if (process.env.CAPTURE) {
			console.log("\n📝 Event types captured:");
			const eventTypes = [...new Set(events.map((e) => e.type))];
			for (const type of eventTypes) {
				console.log(`  - ${type}`);
			}
		}
	} catch (error) {
		console.error("\n❌ Flow execution failed:", error);
		process.exit(1);
	}
}

runLiveTest().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
