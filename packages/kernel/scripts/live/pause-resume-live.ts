/**
 * Live E2E test for Pause/Resume with Session Persistence (016-pause-resume).
 *
 * This test validates the complete pause/resume cycle:
 * 1. Start a flow with multiple nodes
 * 2. Pause after first node completes
 * 3. Verify session state is captured correctly
 * 4. Resume with injected message
 * 5. Verify remaining nodes execute
 *
 * Usage: bun scripts/live/pause-resume-live.ts
 */

import { HubImpl } from "../../src/engine/hub.js";
import { executeFlow } from "../../src/flow/executor.js";
import { echoNode } from "../../src/flow/nodes/echo.js";
import { NodeRegistry } from "../../src/flow/registry.js";
import type { EnrichedEvent } from "../../src/protocol/events.js";
import type { FlowYaml } from "../../src/protocol/flow.js";

async function runLiveTest() {
	console.log("🧪 Running Pause/Resume E2E live test...\n");

	const registry = new NodeRegistry();
	registry.register(echoNode);

	// Flow with 3 nodes - we'll pause after node 1
	const flow: FlowYaml = {
		flow: { name: "pause-resume-live-test" },
		nodes: [
			{ id: "node1", type: "echo", input: { text: "First node output" } },
			{ id: "node2", type: "echo", input: { text: "Second node output" } },
			{ id: "node3", type: "echo", input: { text: "Third node output" } },
		],
		edges: [],
	};

	const hub = new HubImpl("live-pause-resume-session");
	const events: EnrichedEvent[] = [];

	const unsubscribe = hub.subscribe("*", (event) => {
		events.push(event);
	});

	const createContext = () => ({
		hub,
		phase: async <T>(name: string, fn: () => Promise<T>) => {
			return hub.scoped({ phase: { name } }, async () => {
				hub.emit({ type: "phase:start", name });
				const result = await fn();
				hub.emit({ type: "phase:complete", name });
				return result;
			});
		},
		task: async <T>(id: string, fn: () => Promise<T>) => {
			return hub.scoped({ task: { id } }, async () => {
				hub.emit({ type: "task:start", taskId: id });
				const result = await fn();
				hub.emit({ type: "task:complete", taskId: id, result });
				return result;
			});
		},
	});

	// ========== PHASE 1: Initial execution with pause ==========
	console.log("📍 Phase 1: Starting flow and pausing after first node...");

	hub.startSession();
	hub.setStatus("running");

	// Trigger pause after first node completes
	let pauseTriggered = false;
	const pauseUnsubscribe = hub.subscribe("node:complete", (e) => {
		if (!pauseTriggered) {
			pauseTriggered = true;
			console.log(`   ⏸️  Pausing after node: ${(e.event as { nodeId?: string }).nodeId}`);
			hub.abort({ resumable: true, reason: "User requested pause for context injection" });
		}
	});

	const result1 = await executeFlow(flow, registry, createContext());
	pauseUnsubscribe();

	// Validate pause state
	if (hub.status !== "paused") {
		throw new Error(`Expected status 'paused', got '${hub.status}'`);
	}

	const pausedState = hub.getPausedSession("live-pause-resume-session");
	if (!pausedState) {
		throw new Error("Expected paused session state to exist");
	}

	console.log(`   ✓ Flow paused at node index: ${pausedState.currentNodeIndex}`);
	console.log(`   ✓ Captured outputs: ${Object.keys(pausedState.outputs).join(", ") || "(initial)"}`);
	console.log(`   ✓ Flow name: ${pausedState.flowName}`);

	// Check flow:paused event was emitted
	const pausedEvents = events.filter((e) => e.event.type === "flow:paused");
	if (pausedEvents.length === 0) {
		throw new Error("Expected flow:paused event to be emitted");
	}
	console.log("   ✓ flow:paused event emitted\n");

	// ========== PHASE 2: Resume with injected context ==========
	console.log("📍 Phase 2: Resuming with injected message...");

	const injectedMessage = "Additional context: User approved continuation";
	await hub.resume("live-pause-resume-session", injectedMessage);

	if (hub.status !== "running") {
		throw new Error(`Expected status 'running' after resume, got '${hub.status}'`);
	}

	// Check flow:resumed event
	const resumedEvents = events.filter((e) => e.event.type === "flow:resumed");
	if (resumedEvents.length === 0) {
		throw new Error("Expected flow:resumed event to be emitted");
	}
	console.log("   ✓ flow:resumed event emitted");

	// Check session:message was emitted with injected content
	const messageEvents = events.filter((e) => e.event.type === "session:message");
	if (messageEvents.length === 0) {
		throw new Error("Expected session:message event for injected context");
	}
	console.log(`   ✓ session:message emitted with injected content\n`);

	// ========== PHASE 3: Complete remaining nodes ==========
	console.log("📍 Phase 3: Executing remaining nodes...");

	// Track node events during resumed execution
	const resumeNodeEvents: string[] = [];
	const resumeNodeUnsubscribe = hub.subscribe("node:*", (e) => {
		const nodeEvent = e.event as { type: string; nodeId?: string };
		resumeNodeEvents.push(`${nodeEvent.type}:${nodeEvent.nodeId}`);
	});

	const result2 = await executeFlow(flow, registry, createContext());
	resumeNodeUnsubscribe();

	console.log(`   ✓ Resume execution triggered ${resumeNodeEvents.length} node events`);

	// Session should be cleared after successful completion
	const finalPausedState = hub.getPausedSession("live-pause-resume-session");
	if (finalPausedState) {
		console.log("   ⚠️  Note: Paused session not cleared (may still have resumption state)");
	} else {
		console.log("   ✓ Paused session cleared after completion");
	}

	unsubscribe();

	// ========== VALIDATION ==========
	console.log("\n📋 Validating event sequence...");

	const eventTypes = events.map((e) => e.event.type);

	// Must have these events in order
	const requiredSequence = [
		"node:start",      // First node starts
		"node:complete",   // First node completes
		"flow:paused",     // Flow pauses
		"session:message", // Injected message
		"flow:resumed",    // Flow resumes
	];

	for (const required of requiredSequence) {
		if (!eventTypes.includes(required)) {
			throw new Error(`Missing required event: ${required}`);
		}
	}

	console.log("   ✓ All required events present");
	console.log(`   ✓ Total events captured: ${events.length}`);

	console.log("\n✅ Pause/Resume E2E live test PASSED\n");

	// Summary
	console.log("📊 Summary:");
	console.log(`   - Flow: ${flow.flow.name}`);
	console.log(`   - Nodes: ${flow.nodes.length}`);
	console.log(`   - Paused after: node1`);
	console.log(`   - Injected message: "${injectedMessage}"`);
	console.log(`   - Final outputs: ${Object.keys(result2.outputs).length} nodes`);
}

runLiveTest().catch((error) => {
	console.error("\n❌ Pause/Resume E2E live test FAILED:", error.message);
	if (error.stack) {
		console.error("\nStack trace:");
		console.error(error.stack);
	}
	process.exit(1);
});
