// Replay tests for Harness run lifecycle
// Uses fixtures from tests/fixtures/golden/harness/

import { describe, expect, test } from "bun:test";
import { loadHarnessFixture } from "../helpers/fixture-loader.js";
import {
	normalizeHarnessEvents,
	runHarnessFixture,
} from "../helpers/harness-fixture-runner.js";

describe("Harness Run Lifecycle (replay)", () => {
	test("run executes and returns HarnessResult", async () => {
		const fixture = await loadHarnessFixture("harness/run-lifecycle");
		const result = await runHarnessFixture(fixture);

		// Verify result if expected
		if (fixture.expect.result !== undefined) {
			expect(result.result).toEqual(fixture.expect.result);
		}

		// Verify state if expected
		if (fixture.expect.state !== undefined) {
			expect(result.state).toEqual(fixture.expect.state);
		}

		// Verify status if expected
		if (fixture.expect.status !== null && fixture.expect.status !== undefined) {
			expect(result.status).toBe(fixture.expect.status);
		}

		// Verify harness:start and harness:complete events are present
		const normalized = normalizeHarnessEvents(result.events);
		const hasStart = normalized.some(
			(e) => (e.event as { type: string }).type === "harness:start",
		);
		const hasComplete = normalized.some(
			(e) => (e.event as { type: string }).type === "harness:complete",
		);

		expect(hasStart).toBe(true);
		expect(hasComplete).toBe(true);

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
