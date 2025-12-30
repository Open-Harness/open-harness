/**
 * Authoritative live test for Harness implementation.
 *
 * This script runs all replay scenarios against the real Harness implementation.
 * MUST pass before marking Harness milestone complete.
 *
 * Usage: bun scripts/live/harness-live.ts
 */

import { loadHarnessFixture } from "../../tests/helpers/fixture-loader.js";
import {
	normalizeHarnessEvents,
	runHarnessFixture,
} from "../../tests/helpers/harness-fixture-runner.js";

const HARNESS_FIXTURES = [
	"harness/factory",
	"harness/attachment",
	"harness/session",
	"harness/run-lifecycle",
	"harness/phase-task",
];

async function runLiveTest() {
	console.log("🧪 Running Harness live test...");

	let passed = 0;
	let failed = 0;

	for (const fixturePath of HARNESS_FIXTURES) {
		try {
			const fixture = await loadHarnessFixture(fixturePath);
			const result = await runHarnessFixture(fixture);

			// Verify events match expectations
			if (fixture.expect.events) {
				const normalized = normalizeHarnessEvents(result.events);
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

			// Verify state if expected
			if (fixture.expect.state !== undefined) {
				if (
					JSON.stringify(result.state) !== JSON.stringify(fixture.expect.state)
				) {
					console.error(
						`  ✗ ${fixture.scenario}: State doesn't match expectations`,
					);
					failed++;
					continue;
				}
			}

			// Verify result if expected
			if (fixture.expect.result !== undefined) {
				if (
					JSON.stringify(result.result) !==
					JSON.stringify(fixture.expect.result)
				) {
					console.error(
						`  ✗ ${fixture.scenario}: Result doesn't match expectations`,
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
			console.error(`  ✗ ${fixturePath} error:`, error);
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
