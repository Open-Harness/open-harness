// Replay tests for Hub status tracking
// Uses fixtures from tests/fixtures/golden/hub/

import { describe, expect, test } from "bun:test";
import { loadFixture } from "../helpers/fixture-loader.js";
import { runHubFixture } from "../helpers/hub-fixture-runner.js";

describe("Hub Status Tracking (replay)", () => {
	test("tracks hub status and session state", async () => {
		const fixture = await loadFixture("hub/status");
		const result = await runHubFixture(fixture);

		// Verify status expectations from fixture
		if (fixture.expect.status !== null && fixture.expect.status !== undefined) {
			expect(result.status).toBe(fixture.expect.status);
		}

		if (
			fixture.expect.sessionActive !== null &&
			fixture.expect.sessionActive !== undefined
		) {
			expect(result.sessionActive).toBe(fixture.expect.sessionActive);
		}
	});
});
