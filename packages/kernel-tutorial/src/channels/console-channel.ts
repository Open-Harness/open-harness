/**
 * Console Channel
 *
 * Production-ready console channel that demonstrates best practices:
 * - Subscribes to specific event types (not "*")
 * - Handles each event type appropriately
 * - Proper cleanup
 * - Clear, readable output
 */

import type { Attachment, EnrichedEvent } from "@open-harness/kernel";

export const consoleChannel: Attachment = (hub) => {
	const unsubscribes: Array<() => void> = [];

	// Phase lifecycle
	unsubscribes.push(
		hub.subscribe("phase:start", (event) => {
			const payload = event.event as { name: string };
			console.log(`\n📋 Phase: ${payload.name}`);
		}),
	);

	unsubscribes.push(
		hub.subscribe("phase:complete", (event) => {
			const payload = event.event as { name: string };
			console.log(`✅ Phase complete: ${payload.name}\n`);
		}),
	);

	unsubscribes.push(
		hub.subscribe("phase:failed", (event) => {
			const payload = event.event as { name: string; error: string };
			console.log(`❌ Phase failed: ${payload.name} - ${payload.error}\n`);
		}),
	);

	// Task lifecycle
	unsubscribes.push(
		hub.subscribe("task:start", (event) => {
			const payload = event.event as { taskId: string };
			console.log(`  → Task: ${payload.taskId}`);
		}),
	);

	unsubscribes.push(
		hub.subscribe("task:complete", (event) => {
			const payload = event.event as { taskId: string };
			console.log(`  ✓ Task complete: ${payload.taskId}`);
		}),
	);

	unsubscribes.push(
		hub.subscribe("task:failed", (event) => {
			const payload = event.event as { taskId: string; error: string };
			console.log(`  ✗ Task failed: ${payload.taskId} - ${payload.error}`);
		}),
	);

	// Agent events
	unsubscribes.push(
		hub.subscribe("agent:text", (event) => {
			const payload = event.event as { content: string };
			console.log(`💬 ${payload.content}`);
		}),
	);

	unsubscribes.push(
		hub.subscribe("agent:thinking", (event) => {
			const payload = event.event as { content: string };
			console.log(`💭 ${payload.content}`);
		}),
	);

	unsubscribes.push(
		hub.subscribe("agent:start", (event) => {
			const payload = event.event as { agentName: string; runId: string };
			console.log(`🤖 Agent started: ${payload.agentName}`);
		}),
	);

	unsubscribes.push(
		hub.subscribe("agent:complete", (event) => {
			const payload = event.event as {
				agentName: string;
				success: boolean;
				runId: string;
			};
			console.log(`${payload.success ? "✅" : "❌"} Agent complete: ${payload.agentName}`);
		}),
	);

	// Harness lifecycle
	unsubscribes.push(
		hub.subscribe("harness:start", (event) => {
			const payload = event.event as { name: string };
			console.log(`🚀 Starting harness: ${payload.name}`);
		}),
	);

	unsubscribes.push(
		hub.subscribe("harness:complete", (event) => {
			const payload = event.event as { success: boolean; durationMs: number };
			console.log(`${payload.success ? "✅" : "❌"} Harness complete (${payload.durationMs}ms)`);
		}),
	);

	// Return cleanup
	return () => {
		for (const unsubscribe of unsubscribes) {
			unsubscribe();
		}
	};
};
