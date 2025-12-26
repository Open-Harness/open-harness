/**
 * Unit tests for math.ts
 *
 * Tests the add function with various inputs including edge cases.
 */

import { describe, expect, test } from "bun:test";
import { add } from "../../src/utils/math.js";

describe("add", () => {
	test("adds two positive numbers", () => {
		expect(add(2, 3)).toBe(5);
		expect(add(10, 20)).toBe(30);
	});

	test("adds positive and negative numbers", () => {
		expect(add(5, -3)).toBe(2);
		expect(add(-5, 3)).toBe(-2);
	});

	test("adds two negative numbers", () => {
		expect(add(-5, -3)).toBe(-8);
	});

	test("adds with zero", () => {
		expect(add(0, 5)).toBe(5);
		expect(add(5, 0)).toBe(5);
		expect(add(0, 0)).toBe(0);
	});

	test("adds decimal numbers", () => {
		expect(add(0.1, 0.2)).toBeCloseTo(0.3);
		expect(add(1.5, 2.5)).toBe(4);
	});

	test("adds large numbers", () => {
		expect(add(1000000, 2000000)).toBe(3000000);
	});

	test("throws TypeError for non-number arguments", () => {
		expect(() => add("2" as any, 3)).toThrow(TypeError);
		expect(() => add(2, "3" as any)).toThrow(TypeError);
		expect(() => add(null as any, 5)).toThrow(TypeError);
		expect(() => add(5, undefined as any)).toThrow(TypeError);
	});

	test("throws TypeError for NaN arguments", () => {
		expect(() => add(NaN, 5)).toThrow(TypeError);
		expect(() => add(5, NaN)).toThrow(TypeError);
		expect(() => add(NaN, NaN)).toThrow(TypeError);
	});
});
