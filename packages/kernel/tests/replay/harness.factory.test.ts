// Replay tests for Harness factory
// Uses fixtures from tests/fixtures/golden/harness/

import { describe, expect, test } from "bun:test";
import { loadHarnessFixture } from "../helpers/fixture-loader.js";
import {
	normalizeHarnessEvents,
	runHarnessFixture,
} from "../helpers/harness-fixture-runner.js";

describe("Harness Factory (replay)", () => {
	test("creates harness instance with state", async () => {
		const fixture = await loadHarnessFixture("harness/factory");
		const result = await runHarnessFixture(fixture);

		// Verify instance has correct state
		if (fixture.expect.state) {
			expect(result.state).toEqual(fixture.expect.state);
		}

		// Verify events match expectations
		if (fixture.expect.events) {
			const normalized = normalizeHarnessEvents(result.events);
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
