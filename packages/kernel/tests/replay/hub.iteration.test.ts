// Replay tests for Hub async iteration
// Uses fixtures from tests/fixtures/golden/hub/

import { describe, expect, test } from "bun:test";
import { loadFixture } from "../helpers/fixture-loader.js";
import {
	normalizeEvents,
	runHubFixture,
} from "../helpers/hub-fixture-runner.js";

describe("Hub Async Iteration (replay)", () => {
	test("supports async iteration", async () => {
		const fixture = await loadFixture("hub/async-iteration");
		const result = await runHubFixture(fixture);

		if (fixture.expect.events && fixture.expect.events.length > 0) {
			expect(result.events.length).toBeGreaterThanOrEqual(
				fixture.expect.events.length,
			);
			const normalized = normalizeEvents(result.events);
			const expected = fixture.expect.events;

			// Verify first two events match
			if (normalized.length >= 2 && expected.length >= 2) {
				expect(normalized[0].event).toEqual(expected[0].event);
				expect(normalized[1].event).toEqual(expected[1].event);
			}
		}
	});
});
