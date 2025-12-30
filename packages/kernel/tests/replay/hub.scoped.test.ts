// Replay tests for Hub context scoping
// Uses fixtures from tests/fixtures/golden/hub/

import { describe, expect, test } from "bun:test";
import { createHub } from "../../src/engine/hub.js";
import type { EnrichedEvent } from "../../src/protocol/events.js";
import { loadFixture } from "../helpers/fixture-loader.js";
import {
	normalizeEvents,
	runHubFixture,
} from "../helpers/hub-fixture-runner.js";

describe("Hub Context Scoping (replay)", () => {
	test("propagates context via scoped blocks", async () => {
		const fixture = await loadFixture("hub/scoped-context");
		const result = await runHubFixture(fixture);

		if (fixture.expect.events && fixture.expect.events.length > 0) {
			expect(result.events).toHaveLength(fixture.expect.events.length);
			const normalized = normalizeEvents(result.events);
			const expected = fixture.expect.events;

			expect(normalized[0].context.phase?.name).toBe(
				expected[0].context.phase?.name,
			);
			expect(normalized[0].context.sessionId).toBe(
				expected[0].context.sessionId,
			);
		}
	});

	test("nested scopes merge correctly", async () => {
		// This test requires scoped() which the runner doesn't handle directly
		// So we test it directly but keep the pattern consistent
		const hub = createHub("test-session");
		const received: EnrichedEvent[] = [];

		hub.subscribe("*", (event) => {
			received.push(event);
		});

		await hub.scoped({ phase: { name: "Planning" } }, async () => {
			await hub.scoped({ task: { id: "plan" } }, async () => {
				hub.emit({ type: "task:start", taskId: "plan" });
			});
		});

		expect(received).toHaveLength(1);
		expect(received[0].context.phase?.name).toBe("Planning");
		expect(received[0].context.task?.id).toBe("plan");
	});

	test("current() returns inherited context", async () => {
		const hub = createHub("test-session");

		await hub.scoped({ phase: { name: "Planning" } }, async () => {
			const context = hub.current();
			expect(context.phase?.name).toBe("Planning");
			expect(context.sessionId).toBe("test-session");
		});
	});
});
