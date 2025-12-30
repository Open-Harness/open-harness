// Replay tests for Harness session mode
// Uses fixtures from tests/fixtures/golden/harness/

import { describe, expect, test } from "bun:test";
import { loadHarnessFixture } from "../helpers/fixture-loader.js";
import {
	normalizeHarnessEvents,
	runHarnessFixture,
} from "../helpers/harness-fixture-runner.js";

describe("Harness Session Mode (replay)", () => {
	test("startSession enables command handling", async () => {
		const fixture = await loadHarnessFixture("harness/session");
		const result = await runHarnessFixture(fixture);

		// Verify sessionActive if expected
		if (
			fixture.expect.sessionActive !== null &&
			fixture.expect.sessionActive !== undefined
		) {
			expect(result.sessionActive).toBe(fixture.expect.sessionActive);
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
