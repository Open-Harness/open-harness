// Replay tests for Hub commands
// Uses fixtures from tests/fixtures/golden/hub/

import { describe, expect, test } from "bun:test";
import { createHub, type HubImpl } from "../../src/engine/hub.js";
import type { EnrichedEvent } from "../../src/protocol/events.js";

describe("Hub Commands (replay)", () => {
	test("commands emit session:message events", () => {
		const hub = createHub("test-session");
		const received: EnrichedEvent[] = [];

		hub.subscribe("session:*", (event) => {
			received.push(event);
		});

		// Commands should be no-ops if session not active
		hub.send("message");
		hub.sendTo("agent", "message");
		hub.sendToRun("runId", "message");
		expect(received).toHaveLength(0);

		// Activate session
		(hub as HubImpl).startSession();

		hub.send("message");
		hub.sendTo("agent", "message");
		hub.sendToRun("runId", "message");

		expect(received).toHaveLength(3);

		expect(received[0].event.type).toBe("session:message");
		const event0 = received[0].event as Extract<EnrichedEvent["event"], { type: "session:message" }>;
		expect(event0.content).toBe("message");

		expect(received[1].event.type).toBe("session:message");
		const event1 = received[1].event as Extract<EnrichedEvent["event"], { type: "session:message" }>;
		expect(event1.agentName).toBe("agent");

		expect(received[2].event.type).toBe("session:message");
		const event2 = received[2].event as Extract<EnrichedEvent["event"], { type: "session:message" }>;
		expect(event2.runId).toBe("runId");
	});
});
