// Replay tests for Agent runId uniqueness
// Uses fixtures from tests/fixtures/golden/agent/

import { describe, expect, test } from "bun:test";
import {
	normalizeAgentEvents,
	runAgentFixture,
} from "../helpers/agent-fixture-runner.js";
import { loadAgentFixture } from "../helpers/fixture-loader.js";

describe("Agent RunId (replay)", () => {
	test("runId is unique per execution", async () => {
		const fixture = await loadAgentFixture("agent/runid-uniqueness");
		const result = await runAgentFixture(fixture);

		if (fixture.expect.result !== undefined) {
			expect(result.result).toEqual(fixture.expect.result);
		}

		if (fixture.expect.events) {
			const normalized = normalizeAgentEvents(result.events);
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
