/**
 * Authoritative live test for Hub implementation.
 *
 * This script runs all replay scenarios against the real Hub implementation.
 * MUST pass before marking Hub milestone complete.
 *
 * Usage: bun scripts/live/hub-live.ts
 */

import { loadFixture } from "../../tests/helpers/fixture-loader.js";
import {
	normalizeEvents,
	runHubFixture,
} from "../../tests/helpers/hub-fixture-runner.js";

const HUB_FIXTURES = [
	"hub/subscribe-basic",
	"hub/subscribe-filter",
	"hub/scoped-context",
	"hub/unsubscribe",
	"hub/async-iteration",
	"hub/commands",
	"hub/status",
];

async function runLiveTest() {
	console.log("🧪 Running Hub live test...");

	let passed = 0;
	let failed = 0;

	for (const fixturePath of HUB_FIXTURES) {
		try {
			const fixture = await loadFixture(fixturePath);
			const result = await runHubFixture(fixture);

			// Verify events match expectations
			if (fixture.expect.events) {
				const normalized = normalizeEvents(result.events);
				const expected = fixture.expect.events;

				if (normalized.length < expected.length) {
					console.error(
						`  ✗ ${fixture.scenario}: Expected ${expected.length} events, got ${normalized.length}`,
					);
					failed++;
					continue;
				}

				// Compare events using JSON stringify for deep equality
				let eventsMatch = true;
				for (let i = 0; i < expected.length; i++) {
					const normalizedEvent = JSON.stringify({
						event: normalized[i].event,
						context: {
							sessionId: normalized[i].context.sessionId,
							phase: normalized[i].context.phase,
							task: normalized[i].context.task,
							agent: normalized[i].context.agent,
						},
					});
					const expectedEvent = JSON.stringify({
						event: expected[i].event,
						context: expected[i].context,
					});

					if (normalizedEvent !== expectedEvent) {
						eventsMatch = false;
						break;
					}
				}

				if (!eventsMatch) {
					console.error(
						`  ✗ ${fixture.scenario}: Events don't match expectations`,
					);
					failed++;
					continue;
				}
			}

			// Verify status if expected
			if (
				fixture.expect.status !== null &&
				fixture.expect.status !== undefined
			) {
				if (result.status !== fixture.expect.status) {
					console.error(
						`  ✗ ${fixture.scenario}: Expected status ${fixture.expect.status}, got ${result.status}`,
					);
					failed++;
					continue;
				}
			}

			// Verify sessionActive if expected
			if (
				fixture.expect.sessionActive !== null &&
				fixture.expect.sessionActive !== undefined
			) {
				if (result.sessionActive !== fixture.expect.sessionActive) {
					console.error(
						`  ✗ ${fixture.scenario}: Expected sessionActive ${fixture.expect.sessionActive}, got ${result.sessionActive}`,
					);
					failed++;
					continue;
				}
			}

			console.log(`  ✓ ${fixture.scenario}`);
			passed++;
		} catch (error) {
			console.error(`  ✗ ${fixturePath}:`, error);
			failed++;
		}
	}

	console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

	if (failed > 0) {
		console.error("❌ Live test failed");
		process.exit(1);
	}

	console.log("✅ All live tests passed");
}

runLiveTest().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
