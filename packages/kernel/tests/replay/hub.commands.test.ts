// Replay tests for Hub commands
// Uses fixtures from tests/fixtures/golden/hub/

import { describe, test, expect } from "bun:test";
import { createHub } from "../../src/engine/hub.js";

describe("Hub Commands (replay)", () => {
	test("commands emit session:message events", () => {
		const hub = createHub("test-session");
		const received: any[] = [];

		hub.subscribe("session:*", (event) => {
			received.push(event);
		});

		// Commands should be no-ops if session not active
		hub.send("message");
		hub.sendTo("agent", "message");
		hub.sendToRun("runId", "message");
		expect(received).toHaveLength(0);

		// Activate session
		(hub as any).startSession();

		hub.send("message");
		hub.sendTo("agent", "message");
		hub.sendToRun("runId", "message");

		expect(received).toHaveLength(3);
		expect(received[0].event.type).toBe("session:message");
		expect(received[0].event.content).toBe("message");
		expect(received[1].event.agentName).toBe("agent");
		expect(received[2].event.runId).toBe("runId");
	});
});
