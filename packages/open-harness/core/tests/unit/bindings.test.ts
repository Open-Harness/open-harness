// Tests for async binding resolution using JSONata

import { describe, expect, test } from "bun:test";
import { ExpressionError, resolveBindingString, resolveBindings, resolveBindingsResult } from "../../src/index.js";

describe("resolveBindingString", () => {
	test("interpolates multiple bindings", async () => {
		const context = { user: { name: "Ada" }, score: 5 };
		const result = await resolveBindingString("Hello {{ user.name }} ({{ score }})", context);
		expect(result).toBe("Hello Ada (5)");
	});

	test("pure binding preserves type - object", async () => {
		const context = { payload: { a: 1, b: 2 } };
		const result = await resolveBindingString("{{ payload }}", context);
		expect(result).toEqual({ a: 1, b: 2 });
	});

	test("pure binding preserves type - number", async () => {
		const context = { count: 42 };
		const result = await resolveBindingString("{{ count }}", context);
		expect(result).toBe(42);
	});

	test("pure binding preserves type - array", async () => {
		const context = { items: [1, 2, 3] };
		const result = await resolveBindingString("{{ items }}", context);
		expect(result).toEqual([1, 2, 3]);
	});

	test("missing binding returns undefined for pure binding", async () => {
		const result = await resolveBindingString("{{ missing }}", {});
		expect(result).toBeUndefined();
	});

	test("missing binding uses empty string in mixed template", async () => {
		const result = await resolveBindingString("Value: {{ missing }}", {});
		expect(result).toBe("Value: ");
	});
});

describe("resolveBindings", () => {
	test("resolves nested paths via JSONata", async () => {
		const context = {
			flow: { input: { name: "Ada" } },
			user: { meta: { id: 42 } },
		};
		const input: Record<string, unknown> = {
			name: "{{ flow.input.name }}",
			id: "{{ user.meta.id }}",
		};
		const resolved = await resolveBindings(input, context);
		expect(resolved.name).toEqual("Ada");
		expect(resolved.id).toEqual(42);
	});

	test("preserves non-string values for pure bindings", async () => {
		const context = { payload: { a: 1 } };
		const resolved = await resolveBindings({ value: "{{ payload }}" } as Record<string, unknown>, context);
		expect(resolved.value).toEqual({ a: 1 });
	});

	test("walks arrays and objects", async () => {
		const context = { flow: { input: { name: "Ada" } }, count: 2 };
		const resolved = await resolveBindings(
			{
				items: ["{{ flow.input.name }}", "{{ count }}"],
				nested: { title: "Hi {{ flow.input.name }}" },
			} as Record<string, unknown>,
			context,
		);
		expect(resolved.items as unknown[]).toEqual(["Ada", 2]);
		expect(resolved.nested).toEqual({ title: "Hi Ada" });
	});

	test("passes through non-string values unchanged", async () => {
		const context = {};
		const resolved = await resolveBindings({ num: 42, bool: true, nil: null } as Record<string, unknown>, context);
		expect(resolved.num).toBe(42);
		expect(resolved.bool).toBe(true);
		expect(resolved.nil).toBe(null);
	});

	test("resolves JSONata expressions", async () => {
		const context = { count: 10, threshold: 5 };
		const resolved = await resolveBindings(
			{
				comparison: "{{ count > threshold }}",
				math: "{{ count + 5 }}",
			} as Record<string, unknown>,
			context,
		);
		expect(resolved.comparison).toBe(true);
		expect(resolved.math).toBe(15);
	});

	test("resolves JSONata functions", async () => {
		const context = { user: { name: "Alice" } };
		const resolved = await resolveBindings(
			{
				exists: "{{ $exists(user) }}",
				missing: "{{ $exists(missing) }}",
			} as Record<string, unknown>,
			context,
		);
		expect(resolved.exists).toBe(true);
		expect(resolved.missing).toBe(false);
	});
});

describe("resolveBindingsResult", () => {
	test("successfully resolves nested paths", async () => {
		const context = {
			flow: { input: { name: "Ada" } },
			user: { meta: { id: 42 } },
		};
		const input: Record<string, unknown> = {
			name: "{{ flow.input.name }}",
			id: "{{ user.meta.id }}",
		};
		const result = await resolveBindingsResult(input, context);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.name).toEqual("Ada");
			expect(result.value.id).toEqual(42);
		}
	});

	test("successfully resolves arrays and objects", async () => {
		const context = { flow: { input: { name: "Ada" } }, count: 2 };
		const result = await resolveBindingsResult(
			{
				items: ["{{ flow.input.name }}", "{{ count }}"],
				nested: { title: "Hi {{ flow.input.name }}" },
			} as Record<string, unknown>,
			context,
		);
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.items as unknown[]).toEqual(["Ada", 2]);
			expect(result.value.nested).toEqual({ title: "Hi Ada" });
		}
	});

	test("missing path returns undefined, not error", async () => {
		const result = await resolveBindingsResult({ value: "{{ missing.path }}" } as Record<string, unknown>, {});
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.value).toBeUndefined();
		}
	});

	test("syntax error returns ExpressionError", async () => {
		const result = await resolveBindingsResult({ value: "{{ x +++ y }}" } as Record<string, unknown>, {});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBeInstanceOf(ExpressionError);
			expect(result.error.code).toBe("EVALUATION_ERROR");
		}
	});

	test("error propagates through nested structures", async () => {
		const result = await resolveBindingsResult(
			{
				valid: "{{ valid }}",
				nested: {
					invalid: "{{ x +++ y }}",
				},
			} as Record<string, unknown>,
			{ valid: "ok" },
		);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBeInstanceOf(ExpressionError);
		}
	});

	test("passes through non-string values unchanged", async () => {
		const result = await resolveBindingsResult({ num: 42, bool: true, nil: null } as Record<string, unknown>, {});
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.num).toBe(42);
			expect(result.value.bool).toBe(true);
			expect(result.value.nil).toBe(null);
		}
	});
});
