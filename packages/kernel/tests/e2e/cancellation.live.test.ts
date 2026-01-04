/**
 * Live E2E Cancellation Tests
 *
 * These tests use the REAL Claude SDK to verify mid-stream cancellation.
 * They require Claude Code subscription auth (no API key needed).
 *
 * Run with: bun test tests/e2e/cancellation.live.test.ts
 */

import { describe, expect, test } from "bun:test";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { RuntimeEvent } from "../../src/core/events.js";
import { createRuntime, DefaultNodeRegistry, parseFlowYaml } from "../../src/index.js";
import { createClaudeNode } from "../../src/nodes/claude.agent.js";

describe("cancellation live e2e", () => {
	test("pause interrupts real claude agent mid-stream", async () => {
		const flow = parseFlowYaml(`
name: "pause-live"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "Count from 1 to 100, one number per line. Take your time."
edges: []
`);

		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: query }));

		const runtime = createRuntime({ flow, registry });
		const events: RuntimeEvent[] = [];
		let textChunks = 0;

		runtime.onEvent((event) => {
			events.push(event);
			if (event.type === "agent:text:delta") {
				textChunks++;
				// After receiving some streaming deltas, trigger pause
				if (textChunks >= 5) {
					runtime.dispatch({ type: "abort", resumable: true });
				}
			}
		});

		const snapshot = await runtime.run();

		// Verify flow paused
		expect(snapshot.status).toBe("paused");

		// Verify we got agent:paused event
		const pausedEvent = events.find((e) => e.type === "agent:paused");
		expect(pausedEvent).toBeDefined();
		expect(pausedEvent?.type).toBe("agent:paused");

		// Verify paused flag was set (text no longer accumulated - SDK handles history)
		// Consumers needing partial text should accumulate from agent:text:delta events
		const output = snapshot.outputs.agent as { paused?: boolean; sessionId?: string } | undefined;
		expect(output?.paused).toBe(true);
		expect(output?.sessionId).toBeDefined(); // Session ID for resume

		// Verify we got flow:paused event
		const flowPaused = events.find((e) => e.type === "flow:paused");
		expect(flowPaused).toBeDefined();

		// Verify streaming deltas were received (consumers can accumulate these)
		const deltaEvents = events.filter((e) => e.type === "agent:text:delta");
		expect(deltaEvents.length).toBeGreaterThan(0);

		console.log("✅ Pause test passed");
		console.log(`   Received ${textChunks} streaming deltas before pause`);
		console.log(`   Session ID for resume: ${output?.sessionId?.substring(0, 20)}...`);
	}, 60000); // 60s timeout for live test

	test("abort kills real claude agent immediately", async () => {
		const flow = parseFlowYaml(`
name: "abort-live"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "Write a very long essay about the history of computing. Be extremely detailed."
edges: []
`);

		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: query }));

		const runtime = createRuntime({ flow, registry });
		const events: RuntimeEvent[] = [];
		let deltaCount = 0;

		runtime.onEvent((event) => {
			events.push(event);
			if (event.type === "agent:text:delta") {
				deltaCount++;
				// After receiving some streaming deltas, trigger hard abort
				if (deltaCount >= 3) {
					runtime.dispatch({ type: "abort", resumable: false });
				}
			}
		});

		const snapshot = await runtime.run();

		// Verify flow aborted
		expect(snapshot.status).toBe("aborted");

		// Verify we got agent:aborted event
		const abortedEvent = events.find((e) => e.type === "agent:aborted");
		expect(abortedEvent).toBeDefined();
		expect(abortedEvent?.type).toBe("agent:aborted");

		// Verify we got flow:aborted event
		const flowAborted = events.find((e) => e.type === "flow:aborted");
		expect(flowAborted).toBeDefined();

		// Output should be undefined on hard abort (error thrown)
		expect(snapshot.outputs.agent).toBeUndefined();

		console.log("✅ Abort test passed");
		console.log(`   Received ${deltaCount} streaming deltas before abort`);
	}, 60000); // 60s timeout for live test

	test("session preserved after pause allows resume", async () => {
		const flow = parseFlowYaml(`
name: "resume-live"
nodes:
  - id: agent
    type: claude.agent
    input:
      prompt: "Say hello and wait for my response."
edges: []
`);

		const registry = new DefaultNodeRegistry();
		registry.register(createClaudeNode({ queryFn: query }));

		const runtime = createRuntime({ flow, registry });
		const events: RuntimeEvent[] = [];
		let sawDelta = false;

		runtime.onEvent((event) => {
			events.push(event);
			if (event.type === "agent:text:delta" && !sawDelta) {
				sawDelta = true;
				// Pause after first streaming delta
				runtime.dispatch({ type: "abort", resumable: true });
			}
		});

		const snapshot = await runtime.run();

		// Verify paused state
		expect(snapshot.status).toBe("paused");

		// Verify session ID was captured
		const output = snapshot.outputs.agent as { sessionId?: string } | undefined;
		expect(output?.sessionId).toBeDefined();
		expect(typeof output?.sessionId).toBe("string");

		// Verify agent session is stored for resume
		expect(snapshot.agentSessions.agent).toBeDefined();

		console.log("✅ Session preservation test passed");
		console.log(`   Session ID: ${output?.sessionId?.substring(0, 20)}...`);
	}, 60000);
});
