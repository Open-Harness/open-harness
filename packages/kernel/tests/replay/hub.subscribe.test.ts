// Replay tests for Hub subscription
// Uses fixtures from tests/fixtures/golden/hub/

import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import type { EnrichedEvent } from "../../src/protocol/events.js";

describe("Hub Subscription (replay)", () => {
	test("subscribes and receives events", () => {
		const hub = createHub("test-session");
		const received: EnrichedEvent[] = [];

		const unsubscribe = hub.subscribe("*", (event) => {
			received.push(event);
		});

		hub.emit({ type: "harness:start", name: "test" });

		expect(received).toHaveLength(1);
		expect(received[0].event.type).toBe("harness:start");

		// Safe cast after assertion
		const event = received[0].event as Extract<EnrichedEvent["event"], { type: "harness:start" }>;
		expect(event.name).toBe("test");

		expect(received[0].context.sessionId).toBe("test-session");
		expect(received[0].id).toBeDefined();
		expect(received[0].timestamp).toBeInstanceOf(Date);

		unsubscribe();
	});

	test("filters events by pattern", () => {
		const hub = createHub("test-session");
		const received: EnrichedEvent[] = [];

		hub.subscribe("agent:*", (event) => {
			received.push(event);
		});

		hub.emit({ type: "agent:start", agentName: "test", runId: "run-1" });
		hub.emit({ type: "harness:start", name: "test" });

		expect(received).toHaveLength(1);
		expect(received[0].event.type).toBe("agent:start");
	});

	test("unsubscribe stops receiving events", () => {
		const hub = createHub("test-session");
		const received: EnrichedEvent[] = [];

		const unsubscribe = hub.subscribe("*", (event) => {
			received.push(event);
		});

		hub.emit({ type: "harness:start", name: "test" });
		expect(received).toHaveLength(1);

		unsubscribe();

		hub.emit({ type: "harness:complete", success: true, durationMs: 100 });
		expect(received).toHaveLength(1); // Should not receive new event
	});
});
