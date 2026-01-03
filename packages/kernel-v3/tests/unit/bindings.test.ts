import { describe, expect, test } from "bun:test";
import { resolveBindingPath, resolveBindingString, resolveBindings } from "../../src/runtime/bindings.js";

describe("bindings", () => {
	test("resolveBindingPath finds nested values", () => {
		const context = {
			flow: { input: { name: "Ada" } },
			user: { meta: { id: 42 } },
		};
		const found = resolveBindingPath(context, "flow.input.name");
		expect(found.found).toBe(true);
		expect(found.value).toBe("Ada");

		const nested = resolveBindingPath(context, "user.meta.id");
		expect(nested.found).toBe(true);
		expect(nested.value).toBe(42);
	});

	test("resolveBindingPath returns not found for missing values", () => {
		const context = { value: null };
		expect(resolveBindingPath(context, "missing").found).toBe(false);
		expect(resolveBindingPath(context, "value").found).toBe(false);
	});

	test("resolveBindingString interpolates multiple bindings", () => {
		const context = { user: { name: "Ada" }, score: 5 };
		const result = resolveBindingString("Hello {{ user.name }} ({{ score }})", context);
		expect(result).toBe("Hello Ada (5)");
	});

	test("resolveBindingString throws on missing binding", () => {
		expect(() => resolveBindingString("Hi {{ missing }}", {})).toThrow("Missing binding path");
	});

	test("resolveBindings preserves non-string values for pure bindings", () => {
		const context = { payload: { a: 1 } };
		const resolved = resolveBindings({ value: "{{ payload }}" } as Record<string, unknown>, context);
		expect(resolved.value).toEqual({ a: 1 });
	});

	test("resolveBindings walks arrays and objects", () => {
		const context = { flow: { input: { name: "Ada" } }, count: 2 };
		const resolved = resolveBindings(
			{
				items: ["{{ flow.input.name }}", "{{ count }}"],
				nested: { title: "Hi {{ flow.input.name }}" },
			} as Record<string, unknown>,
			context,
		);
		expect(resolved.items as unknown[]).toEqual(["Ada", 2]);
		expect(resolved.nested).toEqual({ title: "Hi Ada" });
	});
});
