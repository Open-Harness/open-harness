// Replay tests for Hub async iteration
// Uses fixtures from tests/fixtures/golden/hub/

import { describe, test, expect } from "bun:test";
import { createHub } from "../../src/engine/hub.js";

describe("Hub Async Iteration (replay)", () => {
	test("supports async iteration", async () => {
		const hub = createHub("test-session");
		const received: any[] = [];

		(async () => {
			for await (const event of hub) {
				received.push(event);
				if (received.length >= 2) break;
			}
		})();

		hub.emit({ type: "harness:start", name: "test" });
		hub.emit({ type: "harness:complete", success: true, durationMs: 100 });

		// Give async iteration time to process
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(received.length).toBeGreaterThanOrEqual(2);
		expect(received[0].event.type).toBe("harness:start");
		expect(received[1].event.type).toBe("harness:complete");
	});
});
