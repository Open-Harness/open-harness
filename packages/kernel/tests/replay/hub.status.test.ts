// Replay tests for Hub status tracking
// Uses fixtures from tests/fixtures/golden/hub/

import { describe, test, expect } from "bun:test";
import { createHub } from "../../src/engine/hub.js";

describe("Hub Status Tracking (replay)", () => {
	test("tracks hub status and session state", () => {
		const hub = createHub("test-session");

		expect(hub.status).toBe("idle");
		expect(hub.sessionActive).toBe(false);

		(hub as any).startSession();

		expect(hub.sessionActive).toBe(true);
		expect(hub.status).toBe("idle"); // Status unchanged by startSession

		(hub as any).setStatus("running");
		expect(hub.status).toBe("running");
	});
});
