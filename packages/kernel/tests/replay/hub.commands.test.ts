// Replay tests for Hub commands
// Uses fixtures from tests/fixtures/golden/hub/

import { describe, expect, test } from "bun:test";
import type { EnrichedEvent } from "../../src/protocol/events.js";
import { loadFixture } from "../helpers/fixture-loader.js";
import { runHubFixture } from "../helpers/hub-fixture-runner.js";

describe("Hub Commands (replay)", () => {
	test("commands emit session:message events", async () => {
		const fixture = await loadFixture("hub/commands");
		const result = await runHubFixture(fixture);

		// Filter to session:message events only (commands emit these)
		const sessionEvents = result.events.filter(
			(e) => e.event.type === "session:message",
		);

		// Should have 3 events (after session is active)
		expect(sessionEvents.length).toBeGreaterThanOrEqual(3);

		if (fixture.expect.events) {
			const expectedSessionEvents = fixture.expect.events.filter(
				(e) => (e.event as { type: string }).type === "session:message",
			);
			expect(sessionEvents.length).toBeGreaterThanOrEqual(
				expectedSessionEvents.length,
			);

			// Verify event content
			const event0 = sessionEvents[0].event as Extract<
				EnrichedEvent["event"],
				{ type: "session:message" }
			>;
			expect(event0.content).toBe("message");

			if (sessionEvents.length >= 2) {
				const event1 = sessionEvents[1].event as Extract<
					EnrichedEvent["event"],
					{ type: "session:message" }
				>;
				expect(event1.agentName).toBe("agent");
			}

			if (sessionEvents.length >= 3) {
				const event2 = sessionEvents[2].event as Extract<
					EnrichedEvent["event"],
					{ type: "session:message" }
				>;
				expect(event2.runId).toBe("runId");
			}
		}
	});
});
