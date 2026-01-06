// Replay tests for FlowSpec structure
// Uses fixtures from tests/fixtures/golden/flow/

import { describe, expect, test } from "bun:test";
import { FlowSpecSchema } from "../../src/flow/validator.js";
import { loadFlowFixture } from "../helpers/fixture-loader.js";

describe("FlowSpec Structure (replay)", () => {
	test("FlowSpec has required and optional fields", async () => {
		const fixture = await loadFlowFixture("flow/flowspec-structure");

		for (const entry of fixture.cases) {
			const parsed = FlowSpecSchema.safeParse(entry.input);
			const expectedValid = entry.valid ?? true;
			expect(parsed.success).toBe(expectedValid);

			if (parsed.success && entry.expected !== undefined) {
				expect(parsed.data).toEqual(entry.expected);
			}
		}
	});
});
