/**
 * Smoke Gate Test
 * Quick sanity check - all smoke tests must pass before integration tests run
 */

import { describe, expect, test } from "bun:test";
import { Container } from "../../src/core/container";
import { TradingDatabase } from "../../src/core/database";
import { MockTimeSource, RealTimeSource } from "../../src/core/time-source";

describe("Smoke Gate - Critical Path Validation", () => {
	test("GATE-01: Core imports work", () => {
		expect(TradingDatabase).toBeDefined();
		expect(Container).toBeDefined();
		expect(RealTimeSource).toBeDefined();
		expect(MockTimeSource).toBeDefined();
	});

	test("GATE-02: Database can be created and closed", () => {
		const db = new TradingDatabase({ path: ":memory:" });
		db.initialize();
		db.close();
		// No errors = pass
		expect(true).toBe(true);
	});

	test("GATE-03: Container can be instantiated", () => {
		const container = new Container();
		expect(container.isMock).toBe(false);
		expect(container.timeSource).toBeInstanceOf(RealTimeSource);
	});

	test("GATE-04: Mock time source is controllable", async () => {
		const mockTime = new MockTimeSource(1000);
		expect(mockTime.now()).toBe(1000);

		await mockTime.sleep(500);
		expect(mockTime.now()).toBe(1500);
	});
});
