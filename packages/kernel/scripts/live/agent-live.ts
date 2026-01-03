/**
 * Authoritative live test for Agent inbox/runId implementation.
 *
 * Usage: bun scripts/live/agent-live.ts
 */

import {
	normalizeAgentEvents,
	runAgentFixture,
} from "../../tests/helpers/agent-fixture-runner.js";
import { loadAgentFixture } from "../../tests/helpers/fixture-loader.js";

const AGENT_FIXTURES = ["agent/inbox-basic", "agent/runid-uniqueness"];

async function runLiveTest() {
	console.log("🧪 Running Agent live test...");

	let passed = 0;
	let failed = 0;

	for (const fixturePath of AGENT_FIXTURES) {
		try {
			const fixture = await loadAgentFixture(fixturePath);
			const result = await runAgentFixture(fixture);

			if (fixture.expect.events) {
				const normalized = normalizeAgentEvents(result.events);
				const expected = fixture.expect.events;

				if (normalized.length < expected.length) {
					console.error(
						`  ✗ ${fixture.scenario}: Expected ${expected.length} events, got ${normalized.length}`,
					);
					failed++;
					continue;
				}

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
