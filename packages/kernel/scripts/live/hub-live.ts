/**
 * Authoritative live test for Hub implementation.
 *
 * This script runs all replay scenarios against the real Hub implementation.
 * MUST pass before marking Hub milestone complete.
 *
 * Usage: bun scripts/live/hub-live.ts
 */

import { createHub } from "../../src/engine/hub.js";
import type { EnrichedEvent } from "../../src/protocol/events.js";

async function runLiveTest() {
	console.log("🧪 Running Hub live test...");

	let passed = 0;
	let failed = 0;

	// Test 1: Basic subscription
	try {
		const hub = createHub("live-test");
		const received: EnrichedEvent[] = [];

		hub.subscribe("*", (event) => {
			received.push(event);
		});

		hub.emit({ type: "harness:start", name: "test" });

		if (received.length === 1 && received[0].event.type === "harness:start") {
			console.log("  ✓ Basic subscription");
			passed++;
		} else {
			console.error("  ✗ Basic subscription failed");
			failed++;
		}
	} catch (error) {
		console.error("  ✗ Basic subscription error:", error);
		failed++;
	}

	// Test 2: Event filtering
	try {
		const hub = createHub("live-test");
		const received: EnrichedEvent[] = [];

		hub.subscribe("agent:*", (event) => {
			received.push(event);
		});

		hub.emit({ type: "agent:start", agentName: "test", runId: "run-1" });
		hub.emit({ type: "harness:start", name: "test" });

		if (received.length === 1 && received[0].event.type === "agent:start") {
			console.log("  ✓ Event filtering");
			passed++;
		} else {
			console.error("  ✗ Event filtering failed");
			failed++;
		}
	} catch (error) {
		console.error("  ✗ Event filtering error:", error);
		failed++;
	}

	// Test 3: Context scoping
	try {
		const hub = createHub("live-test");
		const received: EnrichedEvent[] = [];

		hub.subscribe("*", (event) => {
			received.push(event);
		});

		await hub.scoped({ phase: { name: "Planning" } }, async () => {
			hub.emit({ type: "phase:start", name: "Planning" });
		});

		if (
			received.length === 1 &&
			received[0].context.phase?.name === "Planning"
		) {
			console.log("  ✓ Context scoping");
			passed++;
		} else {
			console.error("  ✗ Context scoping failed");
			failed++;
		}
	} catch (error) {
		console.error("  ✗ Context scoping error:", error);
		failed++;
	}

	// Test 4: Unsubscribe
	try {
		const hub = createHub("live-test");
		const received: EnrichedEvent[] = [];

		const unsubscribe = hub.subscribe("*", (event) => {
			received.push(event);
		});

		hub.emit({ type: "harness:start", name: "test" });
		unsubscribe();
		hub.emit({ type: "harness:complete", success: true, durationMs: 100 });

		if (received.length === 1) {
			console.log("  ✓ Unsubscribe");
			passed++;
		} else {
			console.error("  ✗ Unsubscribe failed");
			failed++;
		}
	} catch (error) {
		console.error("  ✗ Unsubscribe error:", error);
		failed++;
	}

	// Test 5: Async iteration
	try {
		const hub = createHub("live-test");
		const received: EnrichedEvent[] = [];

		(async () => {
			for await (const event of hub) {
				received.push(event);
				if (received.length >= 2) break;
			}
		})();

		hub.emit({ type: "harness:start", name: "test" });
		hub.emit({ type: "harness:complete", success: true, durationMs: 100 });

		// Give async iteration time to process
		await new Promise((resolve) => setTimeout(resolve, 10));

		if (received.length >= 2) {
			console.log("  ✓ Async iteration");
			passed++;
		} else {
			console.error("  ✗ Async iteration failed");
			failed++;
		}
	} catch (error) {
		console.error("  ✗ Async iteration error:", error);
		failed++;
	}

	console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

	if (failed > 0) {
		console.error("❌ Live test failed");
		process.exit(1);
	}

	console.log("✅ All live tests passed");
}

runLiveTest().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
