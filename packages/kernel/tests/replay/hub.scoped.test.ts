// Replay tests for Hub context scoping
// Uses fixtures from tests/fixtures/golden/hub/

import { describe, test, expect } from "bun:test";
import { createHub } from "../../src/engine/hub.js";

describe("Hub Context Scoping (replay)", () => {
	test("propagates context via scoped blocks", async () => {
		const hub = createHub("test-session");
		const received: any[] = [];

		hub.subscribe("*", (event) => {
			received.push(event);
		});

		await hub.scoped({ phase: { name: "Planning" } }, async () => {
			hub.emit({ type: "phase:start", name: "Planning" });
		});

		expect(received).toHaveLength(1);
		expect(received[0].context.phase?.name).toBe("Planning");
		expect(received[0].context.sessionId).toBe("test-session");
	});

	test("nested scopes merge correctly", async () => {
		const hub = createHub("test-session");
		const received: any[] = [];

		hub.subscribe("*", (event) => {
			received.push(event);
		});

		await hub.scoped({ phase: { name: "Planning" } }, async () => {
			await hub.scoped({ task: { id: "plan" } }, async () => {
				hub.emit({ type: "task:start", taskId: "plan" });
			});
		});

		expect(received).toHaveLength(1);
		expect(received[0].context.phase?.name).toBe("Planning");
		expect(received[0].context.task?.id).toBe("plan");
	});

	test("current() returns inherited context", async () => {
		const hub = createHub("test-session");

		await hub.scoped({ phase: { name: "Planning" } }, async () => {
			const context = hub.current();
			expect(context.phase?.name).toBe("Planning");
			expect(context.sessionId).toBe("test-session");
		});
	});
});
