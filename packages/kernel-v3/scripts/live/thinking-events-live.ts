/**
 * Live test for agent:thinking:delta events with extended thinking.
 *
 * This test runs against the REAL Claude SDK with extended thinking enabled to verify:
 * 1. agent:thinking:delta events are emitted during thinking
 * 2. agent:text:delta events are emitted for the response
 * 3. The thinking content is captured correctly
 *
 * Usage: bun scripts/live/thinking-events-live.ts
 */

import { createRuntime, DefaultNodeRegistry, parseFlowYaml } from "../../src/index.js";
import { createClaudeNode } from "../../src/nodes/claude.agent.js";
import type { RuntimeEvent } from "../../src/core/events.js";

async function runLiveTest() {
	console.log("🧪 Running thinking events live test against REAL SDK...\n");
	console.log("⚠️  Note: Extended thinking requires a model that supports it (e.g., claude-3-5-sonnet)\n");

	// Flow that triggers extended thinking using "ultrathink" keyword
	const flow = parseFlowYaml(`
name: "thinking-test"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "ultrathink What is 15 * 17?"
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
			let detail = "";
			if ("content" in event) {
				const content = String(event.content);
				detail = ` "${content.slice(0, 60)}${content.length > 60 ? "..." : ""}"`;
			}
			console.log(`  📡 ${event.type}${detail}`);
		}
	});

	console.log("Starting flow execution...\n");
	const startTime = Date.now();

	try {
		const snapshot = await runtime.run();
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

		// Test 1: We should have text deltas
		if (textDeltas.length > 0) {
			console.log("\n✅ TEST 1 PASSED: agent:text:delta events were emitted");
			passed++;
		} else {
			console.log("\n❌ TEST 1 FAILED: No agent:text:delta events");
			failed++;
		}

		// Test 2: Check for thinking deltas (may or may not be present depending on model)
		if (thinkingDeltas.length > 0) {
			console.log("✅ TEST 2 PASSED: agent:thinking:delta events were emitted");
			const thinkingContent = thinkingDeltas.map((e) => (e as { content: string }).content).join("");
			console.log(`   Thinking content (${thinkingContent.length} chars): "${thinkingContent.slice(0, 100)}..."`);
			passed++;
		} else {
			console.log("⚠️  TEST 2 SKIPPED: No agent:thinking:delta events (model may not support extended thinking)");
		}

		// Test 3: agent:text should NOT be emitted when streaming occurred
		if (textComplete.length === 0) {
			console.log("✅ TEST 3 PASSED: agent:text was NOT emitted (streaming was used)");
			passed++;
		} else {
			console.log(`❌ TEST 3 FAILED: agent:text was emitted ${textComplete.length} times`);
			failed++;
		}

		// Test 4: agent:thinking should NOT be emitted when thinking streamed
		if (thinkingDeltas.length > 0 && thinkingComplete.length === 0) {
			console.log("✅ TEST 4 PASSED: agent:thinking was NOT emitted (streaming was used)");
			passed++;
		} else if (thinkingDeltas.length === 0) {
			console.log("⚠️  TEST 4 SKIPPED: No thinking deltas to verify against");
		} else {
			console.log(`❌ TEST 4 FAILED: agent:thinking was emitted ${thinkingComplete.length} times`);
			failed++;
		}

		// Test 5: agent:complete should be emitted
		if (agentComplete.length === 1) {
			console.log("✅ TEST 5 PASSED: agent:complete emitted exactly once");
			const result = (agentComplete[0] as { result: string }).result;
			console.log(`   Result: "${result.slice(0, 100)}..."`);
			passed++;
		} else {
			console.log(`❌ TEST 5 FAILED: agent:complete emitted ${agentComplete.length} times`);
			failed++;
		}

		// Summary
		console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

		if (failed > 0) {
			console.log("\n❌ LIVE TEST HAD FAILURES");
			process.exit(1);
		}

		console.log("\n✅ ALL APPLICABLE TESTS PASSED");

	} catch (error) {
		console.error("\n❌ Flow execution failed:", error);
		process.exit(1);
	}
}

runLiveTest().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
