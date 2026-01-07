import { describe, expect, test } from "bun:test";
import type { WhenExpr } from "../../src/core/types.js";
import { evaluateWhen } from "../../src/runtime/when.js";

describe("when evaluation", () => {
	test("equals compares resolved values", () => {
		const expr: WhenExpr = { equals: { var: "a", value: 1 } };
		expect(evaluateWhen(expr, { a: 1 })).toBe(true);
		expect(evaluateWhen(expr, { a: 2 })).toBe(false);
	});

	test("missing bindings evaluate to false", () => {
		const expr: WhenExpr = { equals: { var: "missing", value: 1 } };
		expect(evaluateWhen(expr, {})).toBe(false);
	});

	test("not flips truthiness", () => {
		const expr: WhenExpr = {
			not: { equals: { var: "flag", value: true } },
		};
		expect(evaluateWhen(expr, { flag: false })).toBe(true);
		expect(evaluateWhen(expr, { flag: true })).toBe(false);
	});

	test("and/or aggregate conditions", () => {
		const expr: WhenExpr = {
			and: [
				{ equals: { var: "a", value: 1 } },
				{
					or: [{ equals: { var: "b", value: 2 } }, { equals: { var: "c", value: 3 } }],
				},
			],
		};
		expect(evaluateWhen(expr, { a: 1, b: 2 })).toBe(true);
		expect(evaluateWhen(expr, { a: 1, c: 3 })).toBe(true);
		expect(evaluateWhen(expr, { a: 1, b: 4, c: 5 })).toBe(false);
	});
});
