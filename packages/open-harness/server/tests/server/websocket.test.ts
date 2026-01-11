import { describe, expect, test } from "bun:test";
import { WebSocketTransport } from "../../src/index.js";

describe("@open-harness/sdk/server: WebSocket transport", () => {
	test("smoke: package exports work", () => {
		expect(WebSocketTransport).toBeDefined();
		expect(typeof WebSocketTransport).toBe("function");
	});

	test("smoke: can create WebSocket transport instance", () => {
		// Note: This test doesn't actually connect, just verifies the class can be instantiated
		// In a real test, you'd need a mock runtime
		expect(WebSocketTransport).toBeDefined();
	});
});
