// Unit tests for Hub filter matching logic
// Tests pure logic without fixtures

import { describe, expect, test } from "bun:test";
import { matchesFilter } from "../../src/engine/events.js";

describe("matchesFilter", () => {
	test("matches all events with '*'", () => {
		expect(matchesFilter("agent:start", "*")).toBe(true);
		expect(matchesFilter("harness:complete", "*")).toBe(true);
		expect(matchesFilter("any:event", "*")).toBe(true);
	});

	test("matches exact string", () => {
		expect(matchesFilter("agent:start", "agent:start")).toBe(true);
		expect(matchesFilter("agent:start", "agent:text")).toBe(false);
	});

	test("matches prefix pattern", () => {
		expect(matchesFilter("agent:start", "agent:*")).toBe(true);
		expect(matchesFilter("agent:text", "agent:*")).toBe(true);
		expect(matchesFilter("agent:complete", "agent:*")).toBe(true);
		expect(matchesFilter("harness:start", "agent:*")).toBe(false);
	});

	test("matches array of patterns", () => {
		expect(matchesFilter("agent:start", ["agent:*", "harness:*"])).toBe(true);
		expect(matchesFilter("harness:complete", ["agent:*", "harness:*"])).toBe(
			true,
		);
		expect(matchesFilter("task:start", ["agent:*", "harness:*"])).toBe(false);
	});
});
