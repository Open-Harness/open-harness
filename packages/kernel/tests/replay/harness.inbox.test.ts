// Replay tests for Harness inbox routing
// Uses fixtures from tests/fixtures/golden/harness/

import { describe, expect, test } from "bun:test";
import { loadHarnessFixture } from "../helpers/fixture-loader.js";
import {
	normalizeHarnessEvents,
	runHarnessFixture,
} from "../helpers/harness-fixture-runner.js";

describe("Harness Inbox Routing (replay)", () => {
	test("sendToRun routes messages to agent inbox", async () => {
		const fixture = await loadHarnessFixture("harness/inbox-routing");
		const result = await runHarnessFixture(fixture);

		// Verify result if expected
		if (fixture.expect.result !== undefined) {
			expect(result.result).toEqual(fixture.expect.result);
		}

		// Verify events match expectations
		if (fixture.expect.events) {
			const normalized = normalizeHarnessEvents(result.events);
			const expected = fixture.expect.events;

			expect(normalized.length).toBeGreaterThanOrEqual(expected.length);

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
