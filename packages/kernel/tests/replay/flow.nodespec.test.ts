// Replay tests for NodeSpec structure
// Uses fixtures from tests/fixtures/golden/flow/

import { describe, expect, test } from "bun:test";
import { NodeSpecSchema } from "../../src/flow/validator.js";
import { loadFlowFixture } from "../helpers/fixture-loader.js";

describe("NodeSpec Structure (replay)", () => {
	test("NodeSpec has required and optional fields", async () => {
		const fixture = await loadFlowFixture("flow/nodespec-structure");

		for (const entry of fixture.cases) {
			const parsed = NodeSpecSchema.safeParse(entry.input);
			const expectedValid = entry.valid ?? true;
			expect(parsed.success).toBe(expectedValid);
		}
	});
});
