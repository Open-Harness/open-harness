// Tests for when expression evaluation (async with JSONata support)

import { describe, expect, test } from "bun:test";
import type { WhenExpr } from "../../src/index.js";
import { ExpressionError, evaluateWhen, evaluateWhenResult } from "../../src/index.js";

describe("when evaluation", () => {
	describe("undefined/null handling", () => {
		test("undefined when returns true", async () => {
			expect(await evaluateWhen(undefined, {})).toBe(true);
		});

		test("null when returns true", async () => {
			expect(await evaluateWhen(null as unknown as WhenExpr, {})).toBe(true);
		});
	});

	describe("JSONata string expressions", () => {
		test("equality comparison", async () => {
			expect(await evaluateWhen('status = "done"', { status: "done" })).toBe(true);
			expect(await evaluateWhen('status = "done"', { status: "pending" })).toBe(false);
		});

		test("boolean expressions", async () => {
			expect(await evaluateWhen("passed = true", { passed: true })).toBe(true);
			expect(await evaluateWhen("passed = true", { passed: false })).toBe(false);
		});

		test("comparison operators", async () => {
			expect(await evaluateWhen("count > 5", { count: 10 })).toBe(true);
			expect(await evaluateWhen("count > 5", { count: 3 })).toBe(false);
			expect(await evaluateWhen("score >= 80", { score: 80 })).toBe(true);
		});

		test("$exists function", async () => {
			expect(await evaluateWhen("$exists(reviewer)", { reviewer: { text: "ok" } })).toBe(true);
			expect(await evaluateWhen("$exists(reviewer)", {})).toBe(false);
		});

		test("$not function", async () => {
			expect(await evaluateWhen("$not(passed)", { passed: false })).toBe(true);
			expect(await evaluateWhen("$not(passed)", { passed: true })).toBe(false);
		});

		test("and/or operators", async () => {
			expect(await evaluateWhen("a and b", { a: true, b: true })).toBe(true);
			expect(await evaluateWhen("a and b", { a: true, b: false })).toBe(false);
			expect(await evaluateWhen("a or b", { a: false, b: true })).toBe(true);
		});

		test("complex expression", async () => {
			expect(
				await evaluateWhen("$exists(reviewer) and reviewer.passed = true", {
					reviewer: { passed: true },
				}),
			).toBe(true);
			expect(await evaluateWhen("$exists(reviewer) and reviewer.passed = true", {})).toBe(false);
		});

		test("missing path evaluates to falsy", async () => {
			expect(await evaluateWhen("missing.path", {})).toBe(false);
			expect(await evaluateWhen('missing.path = "value"', {})).toBe(false);
		});

		test("nested path access", async () => {
			expect(
				await evaluateWhen("reviewer.output.score > 80", {
					reviewer: { output: { score: 85 } },
				}),
			).toBe(true);
		});
	});

	describe("structured AST format", () => {
		test("equals compares resolved values", async () => {
			const expr: WhenExpr = { equals: { var: "a", value: 1 } };
			expect(await evaluateWhen(expr, { a: 1 })).toBe(true);
			expect(await evaluateWhen(expr, { a: 2 })).toBe(false);
		});

		test("missing bindings evaluate to false", async () => {
			const expr: WhenExpr = { equals: { var: "missing", value: 1 } };
			expect(await evaluateWhen(expr, {})).toBe(false);
		});

		test("not flips truthiness", async () => {
			const expr: WhenExpr = {
				not: { equals: { var: "flag", value: true } },
			};
			expect(await evaluateWhen(expr, { flag: false })).toBe(true);
			expect(await evaluateWhen(expr, { flag: true })).toBe(false);
		});

		test("and/or aggregate conditions", async () => {
			const expr: WhenExpr = {
				and: [
					{ equals: { var: "a", value: 1 } },
					{
						or: [{ equals: { var: "b", value: 2 } }, { equals: { var: "c", value: 3 } }],
					},
				],
			};
			expect(await evaluateWhen(expr, { a: 1, b: 2 })).toBe(true);
			expect(await evaluateWhen(expr, { a: 1, c: 3 })).toBe(true);
			expect(await evaluateWhen(expr, { a: 1, b: 4, c: 5 })).toBe(false);
		});

		test("equals with nested path (JSONata)", async () => {
			const expr: WhenExpr = { equals: { var: "user.role", value: "admin" } };
			expect(await evaluateWhen(expr, { user: { role: "admin" } })).toBe(true);
			expect(await evaluateWhen(expr, { user: { role: "guest" } })).toBe(false);
		});

		test("equals with object value", async () => {
			const expr: WhenExpr = {
				equals: { var: "config", value: { enabled: true } },
			};
			expect(await evaluateWhen(expr, { config: { enabled: true } })).toBe(true);
			expect(await evaluateWhen(expr, { config: { enabled: false } })).toBe(false);
		});
	});
});

describe("evaluateWhenResult", () => {
	describe("undefined/null handling", () => {
		test("undefined when returns ok(true)", async () => {
			const result = await evaluateWhenResult(undefined, {});
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(true);
			}
		});

		test("null when returns ok(true)", async () => {
			const result = await evaluateWhenResult(null as unknown as WhenExpr, {});
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(true);
			}
		});
	});

	describe("JSONata string expressions", () => {
		test("successfully evaluates equality comparison", async () => {
			const result1 = await evaluateWhenResult('status = "done"', { status: "done" });
			expect(result1.isOk()).toBe(true);
			if (result1.isOk()) {
				expect(result1.value).toBe(true);
			}

			const result2 = await evaluateWhenResult('status = "done"', { status: "pending" });
			expect(result2.isOk()).toBe(true);
			if (result2.isOk()) {
				expect(result2.value).toBe(false);
			}
		});

		test("missing path returns false, not error", async () => {
			const result = await evaluateWhenResult("missing.path", {});
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(false);
			}
		});

		test("syntax error returns ExpressionError", async () => {
			const result = await evaluateWhenResult("x +++ y", {});
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error).toBeInstanceOf(ExpressionError);
				expect(result.error.code).toBe("EVALUATION_ERROR");
			}
		});

		test("complex expression succeeds", async () => {
			const result = await evaluateWhenResult("$exists(reviewer) and reviewer.passed = true", {
				reviewer: { passed: true },
			});
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(true);
			}
		});
	});

	describe("structured AST format", () => {
		test("successfully evaluates equals", async () => {
			const expr: WhenExpr = { equals: { var: "a", value: 1 } };
			const result1 = await evaluateWhenResult(expr, { a: 1 });
			expect(result1.isOk()).toBe(true);
			if (result1.isOk()) {
				expect(result1.value).toBe(true);
			}

			const result2 = await evaluateWhenResult(expr, { a: 2 });
			expect(result2.isOk()).toBe(true);
			if (result2.isOk()) {
				expect(result2.value).toBe(false);
			}
		});

		test("missing bindings return false, not error", async () => {
			const expr: WhenExpr = { equals: { var: "missing", value: 1 } };
			const result = await evaluateWhenResult(expr, {});
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(false);
			}
		});

		test("error propagates through not", async () => {
			const expr: WhenExpr = {
				not: { equals: { var: "x +++ y", value: 1 } },
			};
			const result = await evaluateWhenResult(expr, {});
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error).toBeInstanceOf(ExpressionError);
			}
		});

		test("error propagates through and", async () => {
			const expr: WhenExpr = {
				and: [{ equals: { var: "a", value: 1 } }, { equals: { var: "x +++ y", value: 2 } }],
			};
			const result = await evaluateWhenResult(expr, { a: 1 });
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error).toBeInstanceOf(ExpressionError);
			}
		});

		test("error propagates through or", async () => {
			const expr: WhenExpr = {
				or: [{ equals: { var: "x +++ y", value: 1 } }, { equals: { var: "b", value: 2 } }],
			};
			const result = await evaluateWhenResult(expr, { b: 2 });
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error).toBeInstanceOf(ExpressionError);
			}
		});

		test("and/or aggregate conditions succeed", async () => {
			const expr: WhenExpr = {
				and: [
					{ equals: { var: "a", value: 1 } },
					{
						or: [{ equals: { var: "b", value: 2 } }, { equals: { var: "c", value: 3 } }],
					},
				],
			};
			const result = await evaluateWhenResult(expr, { a: 1, b: 2 });
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(true);
			}
		});
	});
});
