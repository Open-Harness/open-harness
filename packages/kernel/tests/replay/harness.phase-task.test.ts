// Replay tests for Harness phase/task helpers
// Uses fixtures from tests/fixtures/golden/harness/

import { describe, expect, test } from "bun:test";
import { loadHarnessFixture } from "../helpers/fixture-loader.js";
import {
	normalizeHarnessEvents,
	runHarnessFixture,
} from "../helpers/harness-fixture-runner.js";

describe("Harness Phase/Task Helpers (replay)", () => {
	test("phase and task helpers propagate context", async () => {
		const fixture = await loadHarnessFixture("harness/phase-task");
		const result = await runHarnessFixture(fixture);

		// Verify phase:start and phase:complete events are present
		const normalized = normalizeHarnessEvents(result.events);
		const hasPhaseStart = normalized.some(
			(e) => (e.event as { type: string }).type === "phase:start",
		);
		const hasPhaseComplete = normalized.some(
			(e) => (e.event as { type: string }).type === "phase:complete",
		);
		const hasTaskStart = normalized.some(
			(e) => (e.event as { type: string }).type === "task:start",
		);
		const hasTaskComplete = normalized.some(
			(e) => (e.event as { type: string }).type === "task:complete",
		);

		expect(hasPhaseStart).toBe(true);
		expect(hasPhaseComplete).toBe(true);
		expect(hasTaskStart).toBe(true);
		expect(hasTaskComplete).toBe(true);

		// Verify events inside phase have phase context
		const phaseEvents = normalized.filter((e) => {
			const eventType = (e.event as { type: string }).type;
			return (
				eventType === "custom:event" ||
				eventType === "task:start" ||
				eventType === "task:complete"
			);
		});

		for (const event of phaseEvents) {
			expect(event.context.phase).toBeDefined();
			expect(event.context.phase?.name).toBe("Planning");
		}

		// Verify events inside task have task context
		const taskEvents = normalized.filter((e) => {
			const eventType = (e.event as { type: string }).type;
			return eventType === "custom:event";
		});

		for (const event of taskEvents) {
			expect(event.context.task).toBeDefined();
			expect(event.context.task?.id).toBe("plan");
		}

		// Verify events match expectations
		if (fixture.expect.events) {
			const expected = fixture.expect.events;

			expect(normalized.length).toBeGreaterThanOrEqual(expected.length);

			// Check that expected events are present
			for (const expectedEvent of expected) {
				const found = normalized.find(
					(e) =>
						JSON.stringify(e.event) === JSON.stringify(expectedEvent.event) &&
						e.context.sessionId === expectedEvent.context.sessionId,
				);
				expect(found).toBeDefined();
			}
		}
	});
});
