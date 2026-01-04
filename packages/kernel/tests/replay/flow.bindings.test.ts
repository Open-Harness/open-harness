// Replay tests for binding paths
// Uses fixtures from tests/fixtures/golden/flow/

import { describe, expect, test } from "bun:test";
import type { BindingContext } from "../../src/flow/bindings.js";
import { resolveBindingString } from "../../src/flow/bindings.js";
import { loadFlowFixture } from "../helpers/fixture-loader.js";

describe("Binding Paths (replay)", () => {
	test("binding paths resolve correctly", async () => {
		const fixture = await loadFlowFixture("flow/binding-paths");
		const context = fixture.context as BindingContext;

		for (const entry of fixture.cases) {
			if (!entry.template) {
				throw new Error(`Missing template for case: ${entry.name}`);
			}
			const template = entry.template;

			const resolved = await resolveBindingString(template, context);
			expect(resolved).toBe(entry.expected);
		}
	});
});
