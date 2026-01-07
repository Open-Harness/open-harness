import { describe, expect, test } from "bun:test";
import { InMemoryStateStore } from "../../src/index.js";

describe("state store", () => {
	test("get/set supports dot paths", () => {
		const store = new InMemoryStateStore({ foo: { bar: 1 } });
		expect(store.get("foo.bar")).toBe(1);

		store.set("foo.baz", 2);
		expect(store.get("foo.baz")).toBe(2);
	});

	test("patch merge combines objects", () => {
		const store = new InMemoryStateStore({ foo: { bar: 1 } });
		store.patch({ op: "merge", path: "foo", value: { baz: 2 } });
		expect(store.get("foo")).toEqual({ bar: 1, baz: 2 });
	});

	test("patch merge replaces non-object targets", () => {
		const store = new InMemoryStateStore({ value: 5 });
		store.patch({ op: "merge", path: "value", value: { next: true } });
		expect(store.get("value")).toEqual({ next: true });
	});

	test("patch set overwrites paths", () => {
		const store = new InMemoryStateStore({ foo: { bar: 1 } });
		store.patch({ op: "set", path: "foo.bar", value: 9 });
		expect(store.get("foo.bar")).toBe(9);
	});
});
