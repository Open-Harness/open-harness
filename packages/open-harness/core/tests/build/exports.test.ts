import { describe, expect, test } from "bun:test";

describe("package exports compile", () => {
	test("core export surface is importable", async () => {
		const mod = await import("../../src/index.ts");
		expect(mod).toBeTruthy();
	});

	test("server export surface is importable", async () => {
		const mod = await import("../../../server/src/index.ts");
		expect(mod).toBeTruthy();
	});

	test("client export surface is importable", async () => {
		const mod = await import("../../../client/src/index.ts");
		expect(mod).toBeTruthy();
	});

	test("react export surface is importable", async () => {
		const mod = await import("../../../react/src/index.ts");
		expect(mod).toBeTruthy();
	});

	test("testing export surface is importable", async () => {
		const mod = await import("../../../testing/src/index.ts");
		expect(mod).toBeTruthy();
	});
});
